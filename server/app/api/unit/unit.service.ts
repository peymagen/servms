import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CREATE UNIT ────────────────────────────────────────────────────────────────
export const createUnit = async (data: any, userId: number) => {
  const query = `
    INSERT INTO units (
      unit_code, unit_name, station_id, platform_location, cluster_name, contract_type,
      contract_category, area_description, sketch_map_file, contractor_id, monthly_fee,
      license_period_start, license_period_end, units_status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    data.unit_code,
    data.unit_name,
    data.station_id,
    data.platform_location ?? null,
    data.cluster_name ?? null,
    data.contract_type ?? "long_term",
    data.contract_category ?? null,
    data.area_description ?? null,
    data.sketch_map_file ?? null,
    data.contractor_id ?? null,
    data.monthly_fee ?? 0,
    data.license_period_start ?? null,
    data.license_period_end ?? null,
    data.units_status ?? "active",
    userId,
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId, unit_code: data.unit_code };
};

// ─── GET UNITS (WITH SEARCH, FILTERS & PAGINATION) ─────────────────────────────
export const getUnits = async (filters: {
  search?: string;
  division_id?: number;
  station_id?: number;
  contract_type?: string;
  cluster_name?: string;
  units_status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];
  const countParams: any[] = [];

  const whereClauses = ["1 = 1"];

  if (filters.search) {
    whereClauses.push("(u.unit_name LIKE ? OR u.unit_code LIKE ? OR st.station_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
    countParams.push(term, term, term);
  }

  if (filters.division_id) {
    whereClauses.push("st.division_id = ?");
    params.push(filters.division_id);
    countParams.push(filters.division_id);
  }

  if (filters.station_id) {
    whereClauses.push("u.station_id = ?");
    params.push(filters.station_id);
    countParams.push(filters.station_id);
  }

  if (filters.contract_type) {
    whereClauses.push("u.contract_type = ?");
    params.push(filters.contract_type);
    countParams.push(filters.contract_type);
  }

  if (filters.cluster_name) {
    whereClauses.push("u.cluster_name LIKE ?");
    const term = `%${filters.cluster_name}%`;
    params.push(term);
    countParams.push(term);
  }

  if (filters.units_status) {
    whereClauses.push("u.units_status = ?");
    params.push(filters.units_status);
    countParams.push(filters.units_status);
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM units u
    LEFT JOIN stations st ON st.id = u.station_id
    ${whereSql}
  `;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT
      u.*,
      st.station_name,
      st.station_code,
      st.division_id,
      d.division_name,
      c.company_name as contractor_name,
      (
        SELECT us.full_name FROM inspections i
        JOIN users us ON us.id = i.inspector_id
        WHERE i.unit_id = u.id AND i.inspector_id IS NOT NULL
        ORDER BY i.inspection_date DESC LIMIT 1
      ) as inspector_name
    FROM units u
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN divisions d ON d.id = st.division_id
    LEFT JOIN contractors c ON c.id = u.contractor_id
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

// ─── GET UNIT BY ID ──────────────────────────────────────────────────────────────
export const getUnitById = async (id: string) => {
  const query = `
    SELECT
      u.*,
      st.station_name,
      st.station_code,
      st.division_id,
      d.division_name,
      c.company_name as contractor_name,
      (
        SELECT us.full_name FROM inspections i
        JOIN users us ON us.id = i.inspector_id
        WHERE i.unit_id = u.id AND i.inspector_id IS NOT NULL
        ORDER BY i.inspection_date DESC LIMIT 1
      ) as inspector_name
    FROM units u
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN divisions d ON d.id = st.division_id
    LEFT JOIN contractors c ON c.id = u.contractor_id
    WHERE u.id = ?
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── EDIT UNIT (PATCH) ───────────────────────────────────────────────────────────
export const editUnit = async (id: string, data: any) => {
  const allowedFields = [
    "unit_name", "station_id", "platform_location", "cluster_name", "contract_type",
    "contract_category", "area_description", "sketch_map_file", "contractor_id",
    "monthly_fee", "license_period_start", "license_period_end", "units_status",
  ];

  const updates: string[] = [];
  const values: any[] = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  if (updates.length === 0) {
    throw new Error("No updateable fields provided");
  }

  values.push(id);
  const query = `UPDATE units SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── DELETE UNIT ─────────────────────────────────────────────────────────────────
export const deleteUnit = async (id: string) => {
  await pool.execute("UPDATE units SET units_status = 'inactive' WHERE id = ?", [id]);
  return { id, deleted: true };
};

// ─── GET UNIT METRICS ────────────────────────────────────────────────────────────
export const getUnitMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "1 = 1";
  if (divisionId) {
    whereSql += " AND st.division_id = ?";
    params.push(divisionId);
  }

  const query = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN u.units_status = 'active' THEN 1 ELSE 0 END) as active_units,
      SUM(CASE WHEN u.units_status = 'inspection_pending' THEN 1 ELSE 0 END) as pending_audit,
      SUM(u.monthly_fee) as revenue_mtd,
      SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM inspections i WHERE i.unit_id = u.id AND i.inspector_id IS NOT NULL
      ) THEN 1 ELSE 0 END) as unassigned
    FROM units u
    LEFT JOIN stations st ON st.id = u.station_id
    WHERE ${whereSql}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  const stats = rows[0] ?? {};

  const inspectorParams: any[] = [];
  let inspectorWhere = "i.inspector_id IS NOT NULL";
  if (divisionId) {
    inspectorWhere += " AND st.division_id = ?";
    inspectorParams.push(divisionId);
  }
  const inspectorQuery = `
    SELECT COUNT(DISTINCT i.inspector_id) as inspector_count
    FROM inspections i
    INNER JOIN units u ON u.id = i.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    WHERE ${inspectorWhere}
  `;
  const [inspectorRows] = await pool.execute<RowDataPacket[]>(inspectorQuery, inspectorParams);

  return {
    totalStations: Number(stats.total ?? 0),
    activeClusters: Number(stats.active_units ?? 0),
    inspectors: Number(inspectorRows[0]?.inspector_count ?? 0),
    unassigned: Number(stats.unassigned ?? 0),
    pendingAudit: Number(stats.pending_audit ?? 0),
    revenueMtd: Number(stats.revenue_mtd ?? 0),
  };
};
