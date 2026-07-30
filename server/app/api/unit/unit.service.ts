import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type IUnitCreate, type IUnitUpdate } from "./unit.dto";

// Resolves the effective division_id for a unit no matter which of the three
// polymorphic location types it uses (station/train/cluster all carry their own
// division_id transitively).
const DIVISION_EXPR = `COALESCE(st.division_id, tr.division_id, cl.division_id)`;

const BASE_JOINS = `
  FROM units u
  LEFT JOIN stations st ON st.id = u.station_id
  LEFT JOIN trains tr ON tr.id = u.train_id
  LEFT JOIN location_clusters cl ON cl.id = u.cluster_id
  LEFT JOIN divisions d ON d.id = ${DIVISION_EXPR}
  LEFT JOIN contractors c ON c.id = u.contractor_id
  LEFT JOIN dropdown_options cat ON cat.id = u.contract_category_id
`;

const SELECT_COLUMNS = `
  u.*,
  st.station_name, st.station_code,
  tr.train_name, tr.train_number,
  cl.cluster_name as cluster_display_name, cl.cluster_type,
  d.id as division_id, d.division_name,
  c.company_name as contractor_name,
  cat.label as contract_category_label,
  (
    SELECT us.full_name FROM inspections i
    JOIN users us ON us.id = i.inspector_id
    WHERE i.unit_id = u.id AND i.inspector_id IS NOT NULL
    ORDER BY i.inspection_date DESC LIMIT 1
  ) as inspector_name
`;

// Only the FK matching location_type should ever be set — clears the other two so a
// unit can never simultaneously point at a station and a train, etc.
function resolveLocationFields(data: Partial<IUnitCreate>) {
  const locationType = data.location_type;
  if (!locationType) return {};
  return {
    station_id: locationType === "station" ? data.station_id ?? null : null,
    train_id: locationType === "train" ? data.train_id ?? null : null,
    cluster_id: locationType === "cluster" ? data.cluster_id ?? null : null,
  };
}

// ─── CREATE UNIT ────────────────────────────────────────────────────────────────
export const createUnit = async (data: IUnitCreate, userId: number) => {
  const location = resolveLocationFields(data);

  const query = `
    INSERT INTO units (
      unit_code, unit_name, location_type, station_id, train_id, cluster_id,
      platform_location, duration_type, contract_type, contract_category_id,
      area_description, sketch_map_file, contractor_id, monthly_fee,
      license_period_start, license_period_end, units_status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    data.unit_code,
    data.unit_name,
    data.location_type,
    location.station_id ?? null,
    location.train_id ?? null,
    location.cluster_id ?? null,
    data.platform_location ?? null,
    data.duration_type ?? "long_term",
    data.contract_type ?? null,
    data.contract_category_id ?? null,
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
  train_id?: number;
  cluster_id?: number;
  location_type?: string;
  contract_type?: string;
  contract_category_id?: number;
  units_status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];

  const whereClauses = ["1 = 1"];

  if (filters.search) {
    whereClauses.push("(u.unit_name LIKE ? OR u.unit_code LIKE ? OR st.station_name LIKE ? OR tr.train_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (filters.division_id) {
    whereClauses.push(`${DIVISION_EXPR} = ?`);
    params.push(filters.division_id);
  }
  if (filters.location_type) {
    whereClauses.push("u.location_type = ?");
    params.push(filters.location_type);
  }
  if (filters.station_id) {
    whereClauses.push("u.station_id = ?");
    params.push(filters.station_id);
  }
  if (filters.train_id) {
    whereClauses.push("u.train_id = ?");
    params.push(filters.train_id);
  }
  if (filters.cluster_id) {
    whereClauses.push("u.cluster_id = ?");
    params.push(filters.cluster_id);
  }
  if (filters.contract_type) {
    whereClauses.push("u.contract_type = ?");
    params.push(filters.contract_type);
  }
  if (filters.contract_category_id) {
    whereClauses.push("u.contract_category_id = ?");
    params.push(filters.contract_category_id);
  }
  if (filters.units_status) {
    whereClauses.push("u.units_status = ?");
    params.push(filters.units_status);
  } else {
    whereClauses.push("u.units_status != 'inactive'");
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const countQuery = `SELECT COUNT(*) as total ${BASE_JOINS} ${whereSql}`;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, params);
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT ${SELECT_COLUMNS}
    ${BASE_JOINS}
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

// ─── GET UNIT BY ID ──────────────────────────────────────────────────────────────
export const getUnitById = async (id: string) => {
  const query = `SELECT ${SELECT_COLUMNS} ${BASE_JOINS} WHERE u.id = ?`;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── EDIT UNIT (PATCH) ───────────────────────────────────────────────────────────
export const editUnit = async (id: string, data: IUnitUpdate) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields: Array<keyof IUnitUpdate> = [
    "unit_name", "platform_location", "duration_type", "contract_type", "contract_category_id",
    "area_description", "sketch_map_file", "contractor_id",
    "monthly_fee", "license_period_start", "license_period_end", "units_status",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  if (data.location_type !== undefined) {
    const location = resolveLocationFields(data);
    updates.push("location_type = ?", "station_id = ?", "train_id = ?", "cluster_id = ?");
    values.push(data.location_type, location.station_id ?? null, location.train_id ?? null, location.cluster_id ?? null);
  }

  if (updates.length === 0) {
    throw new Error("No updateable fields provided");
  }

  values.push(id);
  const query = `UPDATE units SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  return getUnitById(id);
};

// ─── DELETE UNIT ─────────────────────────────────────────────────────────────────
export const deleteUnit = async (id: string) => {
  await pool.execute("UPDATE units SET units_status = 'inactive' WHERE id = ?", [id]);
  return { id, deleted: true };
};

// ─── GET UNIT METRICS ────────────────────────────────────────────────────────────
export const getUnitMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "u.units_status != 'inactive'";
  if (divisionId) {
    whereSql += ` AND ${DIVISION_EXPR} = ?`;
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
    ${BASE_JOINS}
    WHERE ${whereSql}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  const stats = rows[0] ?? {};

  const inspectorParams: any[] = [];
  let inspectorWhere = "i.inspector_id IS NOT NULL";
  if (divisionId) {
    inspectorWhere += ` AND ${DIVISION_EXPR} = ?`;
    inspectorParams.push(divisionId);
  }
  const inspectorQuery = `
    SELECT COUNT(DISTINCT i.inspector_id) as inspector_count
    FROM inspections i
    INNER JOIN units u ON u.id = i.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN trains tr ON tr.id = u.train_id
    LEFT JOIN location_clusters cl ON cl.id = u.cluster_id
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
