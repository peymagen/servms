import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import createHttpError from "http-errors";
import { getReportModule, getReportField, type ReportModuleDef, type ReportField } from "./report.registry";
import { type GenerateReportInput, type ReportFilterInput, type ReportTemplateCreate, type ReportTemplateUpdate } from "./report.dto";

const OPERATORS_BY_TYPE: Record<ReportField["type"], string[]> = {
  string: ["eq", "neq", "like", "in"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  enum: ["eq", "neq", "in"],
  boolean: ["eq"],
};

// Every user-controlled value here becomes a bound `?` parameter — never a
// SQL identifier. `field.column` always comes from the server-authored
// registry (report.registry.ts), never from client input.
const buildFilterClause = (moduleDef: ReportModuleDef, filter: ReportFilterInput): { sql: string; params: any[] } => {
  const field = getReportField(moduleDef, filter.field);
  if (!field || !field.filterable) {
    throw createHttpError(400, `"${filter.field}" is not a filterable field on ${moduleDef.label}`);
  }
  const allowedOps = OPERATORS_BY_TYPE[field.type];
  if (!allowedOps.includes(filter.operator)) {
    throw createHttpError(400, `Operator "${filter.operator}" is not valid for field "${filter.field}"`);
  }
  if (field.type === "enum" && field.enumValues) {
    const values = filter.operator === "in" ? (Array.isArray(filter.value) ? filter.value : []) : [filter.value];
    for (const v of values) {
      if (!field.enumValues.includes(String(v))) {
        throw createHttpError(400, `"${v}" is not a valid value for "${filter.field}"`);
      }
    }
  }

  switch (filter.operator) {
    case "eq":
      return { sql: `${field.column} = ?`, params: [filter.value] };
    case "neq":
      return { sql: `${field.column} != ?`, params: [filter.value] };
    case "like":
      return { sql: `${field.column} LIKE ?`, params: [`%${filter.value}%`] };
    case "gt":
      return { sql: `${field.column} > ?`, params: [filter.value] };
    case "gte":
      return { sql: `${field.column} >= ?`, params: [filter.value] };
    case "lt":
      return { sql: `${field.column} < ?`, params: [filter.value] };
    case "lte":
      return { sql: `${field.column} <= ?`, params: [filter.value] };
    case "between":
      return { sql: `${field.column} BETWEEN ? AND ?`, params: [filter.value, filter.value2] };
    case "in": {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (values.length === 0) throw createHttpError(400, `"${filter.field}" in-filter requires at least one value`);
      return { sql: `${field.column} IN (${values.map(() => "?").join(", ")})`, params: values };
    }
    default:
      throw createHttpError(400, `Unsupported operator "${filter.operator}"`);
  }
};

interface QueryContext {
  whereSql: string;
  params: any[];
}

const buildWhere = (moduleDef: ReportModuleDef, filters: ReportFilterInput[] | undefined, forcedDivisionId?: number): QueryContext => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (moduleDef.statusColumn) {
    clauses.push(moduleDef.statusColumn);
  }

  if (forcedDivisionId && moduleDef.divisionColumn) {
    clauses.push(`${moduleDef.divisionColumn} = ?`);
    params.push(forcedDivisionId);
  }

  for (const filter of filters ?? []) {
    // A division-scoped user's own division filter above already constrains
    // the result set; still validate any additional filters they pass so a
    // scoped user can't smuggle in a different division_id value.
    if (forcedDivisionId && filter.field === "division_id") continue;
    const { sql, params: filterParams } = buildFilterClause(moduleDef, filter);
    clauses.push(sql);
    params.push(...filterParams);
  }

  return { whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
};

const buildSelectClause = (moduleDef: ReportModuleDef, fieldKeys: string[]): string => {
  if (!fieldKeys.length) throw createHttpError(400, "At least one field must be selected");
  return fieldKeys
    .map((key) => {
      const field = getReportField(moduleDef, key);
      if (!field) throw createHttpError(400, `"${key}" is not a valid field on ${moduleDef.label}`);
      return `${field.column} AS \`${field.key}\``;
    })
    .join(", ");
};

export const resolveModuleOrThrow = (moduleKey: string): ReportModuleDef => {
  const moduleDef = getReportModule(moduleKey);
  if (!moduleDef) throw createHttpError(400, `Unknown report module "${moduleKey}"`);
  return moduleDef;
};

// Runtime, per-request permission check against the SAME role_permissions
// matrix used everywhere else — the Report Builder must never become a
// backdoor around a module's own view/export permission just because the
// caller has generic "reports" access.
export const assertModuleAccess = async (
  user: { role_id: number; role_name: string },
  moduleDef: ReportModuleDef,
  action: "view" | "export" = "view"
): Promise<void> => {
  if (user.role_name === "super_admin_hq") return;
  const column = action === "export" ? "can_export" : "can_view";
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${column} AS allowed FROM role_permissions WHERE role_id = ? AND module_name = ? AND status = 1`,
    [user.role_id, moduleDef.permissionModule]
  );
  if (!rows.length || !rows[0]!.allowed) {
    throw createHttpError(403, `You do not have permission to ${action} ${moduleDef.label} data`);
  }
};

export interface GenerateReportResult {
  rows: RowDataPacket[];
  total: number;
  grouped: boolean;
}

export const generateReport = async (input: GenerateReportInput, forcedDivisionId?: number): Promise<GenerateReportResult> => {
  const moduleDef = resolveModuleOrThrow(input.module_key);
  const { whereSql, params } = buildWhere(moduleDef, input.filters, forcedDivisionId);
  const limit = Number.isInteger(input.limit) ? Math.min(input.limit as number, 5000) : 200;
  const offset = Number.isInteger(input.offset) ? (input.offset as number) : 0;

  if (input.group_by && input.group_by.length > 0) {
    const groupFields = input.group_by.map((key) => {
      const field = getReportField(moduleDef, key);
      if (!field || !field.groupable) throw createHttpError(400, `"${key}" is not a groupable field on ${moduleDef.label}`);
      return field;
    });
    let aggregateSql = "";
    if (input.aggregate_field) {
      const aggField = getReportField(moduleDef, input.aggregate_field);
      if (!aggField || aggField.type !== "number") {
        throw createHttpError(400, `"${input.aggregate_field}" is not a numeric field on ${moduleDef.label}`);
      }
      aggregateSql = `, SUM(${aggField.column}) AS aggregate_sum`;
    }
    const groupSelect = groupFields.map((field) => `${field.column} AS \`${field.key}\``).join(", ");
    const groupBySql = groupFields.map((field) => field.column).join(", ");
    const query = `
      SELECT ${groupSelect}, COUNT(*) AS count${aggregateSql}
      ${moduleDef.baseQuery}
      ${whereSql}
      GROUP BY ${groupBySql}
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return { rows, total: rows.length, grouped: true };
  }

  const selectSql = buildSelectClause(moduleDef, input.fields);

  const countQuery = `SELECT COUNT(*) as total ${moduleDef.baseQuery} ${whereSql}`;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, params);
  const total = Number(countRows[0]?.total ?? 0);

  let orderSql = "";
  if (input.sort) {
    const sortField = getReportField(moduleDef, input.sort.field);
    if (!sortField || !sortField.sortable) {
      throw createHttpError(400, `"${input.sort.field}" is not a sortable field on ${moduleDef.label}`);
    }
    const direction = input.sort.direction === "desc" ? "DESC" : "ASC";
    orderSql = `ORDER BY ${sortField.column} ${direction}`;
  }

  const query = `
    SELECT ${selectSql}
    ${moduleDef.baseQuery}
    ${whereSql}
    ${orderSql}
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { rows, total, grouped: false };
};

// ─── REPORT TEMPLATES (saved reports) ──────────────────────────────────────────
export const createTemplate = async (data: ReportTemplateCreate, userId: number) => {
  resolveModuleOrThrow(data.module_key);
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO report_templates (name, description, module_key, fields, filters, sort, group_by, is_shared, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description ?? null,
      data.module_key,
      JSON.stringify(data.fields ?? []),
      JSON.stringify(data.filters ?? []),
      JSON.stringify(data.sort ?? null),
      JSON.stringify(data.group_by ?? []),
      data.is_shared ? 1 : 0,
      userId,
      userId,
    ]
  );
  return { id: result.insertId };
};

const assertTemplateOwnerOrPrivileged = (template: RowDataPacket, user: { id: number; role_name: string }) => {
  const isPrivileged = ["super_admin_hq", "hq_admin"].includes(user.role_name);
  if (!isPrivileged && template.created_by !== user.id) {
    throw createHttpError(403, "You can only modify report templates you created");
  }
};

export const getTemplateById = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT rt.*, cu.full_name as created_by_name, uu.full_name as updated_by_name
     FROM report_templates rt
     LEFT JOIN users cu ON cu.id = rt.created_by
     LEFT JOIN users uu ON uu.id = rt.updated_by
     WHERE rt.id = ? AND rt.status = 1`,
    [id]
  );
  return rows[0] ?? null;
};

export const editTemplate = async (id: string, data: ReportTemplateUpdate, user: { id: number; role_name: string }) => {
  const template = await getTemplateById(id);
  if (!template) throw createHttpError(404, "Report template not found");
  assertTemplateOwnerOrPrivileged(template, user);

  const updates: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { updates.push("name = ?"); values.push(data.name); }
  if (data.description !== undefined) { updates.push("description = ?"); values.push(data.description); }
  if (data.fields !== undefined) { updates.push("fields = ?"); values.push(JSON.stringify(data.fields)); }
  if (data.filters !== undefined) { updates.push("filters = ?"); values.push(JSON.stringify(data.filters)); }
  if (data.sort !== undefined) { updates.push("sort = ?"); values.push(JSON.stringify(data.sort)); }
  if (data.group_by !== undefined) { updates.push("group_by = ?"); values.push(JSON.stringify(data.group_by)); }
  if (data.is_shared !== undefined) { updates.push("is_shared = ?"); values.push(data.is_shared ? 1 : 0); }
  if (updates.length === 0) throw createHttpError(400, "No fields provided to update");

  updates.push("updated_by = ?");
  values.push(user.id, id);
  await pool.execute(`UPDATE report_templates SET ${updates.join(", ")} WHERE id = ?`, values);
  return { id: Number(id) };
};

export const deleteTemplate = async (id: string, user: { id: number; role_name: string }) => {
  const template = await getTemplateById(id);
  if (!template) throw createHttpError(404, "Report template not found");
  assertTemplateOwnerOrPrivileged(template, user);
  await pool.execute("UPDATE report_templates SET status = 0 WHERE id = ?", [id]);
  return { id: Number(id), deleted: true };
};

export const listTemplates = async (user: { id: number; role_name: string }, moduleKey?: string) => {
  const isPrivileged = ["super_admin_hq", "hq_admin"].includes(user.role_name);
  const clauses = ["rt.status = 1"];
  const params: any[] = [];
  if (!isPrivileged) {
    clauses.push("(rt.created_by = ? OR rt.is_shared = 1)");
    params.push(user.id);
  }
  if (moduleKey) {
    clauses.push("rt.module_key = ?");
    params.push(moduleKey);
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT rt.*, cu.full_name as created_by_name
     FROM report_templates rt
     LEFT JOIN users cu ON cu.id = rt.created_by
     WHERE ${clauses.join(" AND ")}
     ORDER BY rt.updated_at DESC`,
    params
  );
  return rows;
};

export const recordTemplateUsage = async (templateId: number) => {
  await pool.execute(
    "UPDATE report_templates SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = ?",
    [templateId]
  );
};

// ─── EXPORT HISTORY (paginated) ─────────────────────────────────────────────────
export const getExportHistory = async (filters: { module_key?: string; limit?: number; offset?: number }) => {
  const clauses: string[] = [];
  const params: any[] = [];
  if (filters.module_key) {
    clauses.push("re.module_key = ?");
    params.push(filters.module_key);
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 20;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;

  const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM report_exports re ${whereSql}`, params);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT re.*, u.full_name as exported_by_name, rt.name as template_name
     FROM report_exports re
     LEFT JOIN users u ON u.id = re.exported_by
     LEFT JOIN report_templates rt ON rt.id = re.report_template_id
     ${whereSql}
     ORDER BY re.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return { total: Number(countRows[0]?.total ?? 0), rows };
};

// ─── DASHBOARD METRICS ──────────────────────────────────────────────────────────
export const getReportDashboardMetrics = async () => {
  const [totalRows] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as total FROM report_templates WHERE status = 1");
  const [moduleWise] = await pool.execute<RowDataPacket[]>(
    "SELECT module_key, COUNT(*) as count FROM report_templates WHERE status = 1 GROUP BY module_key"
  );
  const [totalExportsRows] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as total FROM report_exports");
  const [recentExports] = await pool.execute<RowDataPacket[]>(
    `SELECT re.*, u.full_name as exported_by_name, rt.name as template_name
     FROM report_exports re
     LEFT JOIN users u ON u.id = re.exported_by
     LEFT JOIN report_templates rt ON rt.id = re.report_template_id
     ORDER BY re.created_at DESC LIMIT 10`
  );
  const [mostUsed] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, module_key, usage_count, last_used_at FROM report_templates
     WHERE status = 1 AND usage_count > 0 ORDER BY usage_count DESC LIMIT 10`
  );

  return {
    totalTemplates: Number(totalRows[0]?.total ?? 0),
    totalExports: Number(totalExportsRows[0]?.total ?? 0),
    moduleWise,
    recentExports,
    mostUsed,
  };
};
