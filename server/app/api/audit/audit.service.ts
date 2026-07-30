import { pool } from "../../common/services/sql.service";
import { type RowDataPacket } from "mysql2";

export interface AuditLogFilters {
  module?: string;
  recordId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const getAuditLogs = async (filters: AuditLogFilters) => {
  const limit = filters.limit ?? 25;
  const offset = filters.offset ?? 0;
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters.module) {
    whereClauses.push("a.module_name = ?");
    params.push(filters.module);
  }
  if (filters.recordId) {
    whereClauses.push("a.record_id = ?");
    params.push(filters.recordId);
  }
  if (filters.userId) {
    whereClauses.push("a.user_id = ?");
    params.push(filters.userId);
  }
  if (filters.action) {
    whereClauses.push("a.action = ?");
    params.push(filters.action);
  }
  if (filters.from) {
    whereClauses.push("a.created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    whereClauses.push("a.created_at <= ?");
    params.push(filters.to);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM audit_logs a ${whereSql}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT
      a.id, a.user_id, a.role_name, a.action, a.module_name, a.record_id,
      a.old_data, a.new_data, a.details, a.ip_address, a.user_agent, a.created_at,
      u.full_name as user_full_name, u.username as user_username
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT ${Number.isInteger(limit) ? limit : 25} OFFSET ${Number.isInteger(offset) ? offset : 0}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

// Same filters as getAuditLogs but capped and unpaginated, for export.
export const getAuditLogsForExport = async (filters: Omit<AuditLogFilters, "limit" | "offset">) => {
  const result = await getAuditLogs({ ...filters, limit: 2000, offset: 0 });
  return result.rows;
};

export const getDistinctModules = async () => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT DISTINCT module_name FROM audit_logs WHERE module_name IS NOT NULL ORDER BY module_name ASC"
  );
  return rows.map((r) => r.module_name as string);
};
