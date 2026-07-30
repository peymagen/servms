import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type IInspectionCreate, type IInspectionUpdate } from "./inspection.dto";

const SELECT_INSPECTION_JOIN = `
  SELECT
    i.*,
    u.unit_name,
    st.station_name,
    d.division_name,
    t.train_name, t.train_number,
    ic.label AS inspection_category_label,
    it.label AS inspection_type_label,
    ins.full_name AS inspector_name,
    au.full_name AS assigned_to_user_name,
    cu.full_name AS closed_by_name
  FROM inspections i
  LEFT JOIN units u ON u.id = i.unit_id
  LEFT JOIN stations st ON st.id = COALESCE(i.station_id, u.station_id)
  LEFT JOIN divisions d ON d.id = i.division_id
  LEFT JOIN trains t ON t.id = i.train_id
  LEFT JOIN dropdown_options ic ON ic.id = i.inspection_category_id
  LEFT JOIN dropdown_options it ON it.id = i.inspection_type_id
  LEFT JOIN users ins ON ins.id = i.inspector_id
  LEFT JOIN users au ON au.id = i.assigned_to_user_id
  LEFT JOIN users cu ON cu.id = i.closed_by
`;

// Atomic per-year sequence -> "INSP-2026-000154". Uses the well-known MySQL
// counter idiom (INSERT ... ON DUPLICATE KEY UPDATE col = LAST_INSERT_ID(expr))
// so concurrent requests never hand out the same number.
export const generateInspectionNo = async (): Promise<string> => {
  const year = new Date().getFullYear();
  await pool.execute(
    `INSERT INTO inspection_number_counters (year, last_number) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [year]
  );
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT LAST_INSERT_ID() as seq`);
  const seq = Number(rows[0]?.seq ?? 1);
  return `INSP-${year}-${String(seq).padStart(6, "0")}`;
};

export const getUnitDivisionId = async (unitId: number): Promise<number | null> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT st.division_id FROM units u LEFT JOIN stations st ON st.id = u.station_id WHERE u.id = ?`,
    [unitId]
  );
  return rows[0]?.division_id ?? null;
};

export const recordStatusChange = async (
  inspectionId: number,
  fromStatus: string | null,
  toStatus: string,
  changedBy: number | null,
  remarks?: string
) => {
  await pool.execute(
    `INSERT INTO inspection_status_history (inspection_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
    [inspectionId, fromStatus, toStatus, changedBy, remarks ?? null]
  );
};

const assertInspectionExists = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, inspector_id, inspection_status FROM inspections WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows.length) throw new Error("Inspection not found");
  return rows[0]!;
};

// ─── CREATE INSPECTION (always starts as Draft) ────────────────────────────────
export const createInspection = async (data: IInspectionCreate, userId: number) => {
  const [userRows] = await pool.execute<RowDataPacket[]>("SELECT full_name, designation FROM users WHERE id = ?", [userId]);
  const user = userRows[0];

  let divisionId = data.division_id ?? null;
  if (!divisionId) {
    divisionId = await getUnitDivisionId(data.unit_id);
  }

  const inspectionNo = await generateInspectionNo();

  const query = `
    INSERT INTO inspections (
      inspection_no, unit_id, division_id, station_id, train_id,
      inspecting_official_name, designation, place_of_posting,
      inspection_category_id, inspection_type_id, inspection_date,
      observations, deficiencies, recommendations, remarks,
      priority, inspection_status, inspector_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
  `;

  const values = [
    inspectionNo,
    data.unit_id,
    divisionId,
    data.station_id ?? null,
    data.train_id ?? null,
    data.inspecting_official_name ?? user?.full_name ?? null,
    data.designation ?? user?.designation ?? null,
    data.place_of_posting ?? null,
    data.inspection_category_id,
    data.inspection_type_id,
    data.inspection_date,
    data.observations ?? null,
    data.deficiencies ?? null,
    data.recommendations ?? null,
    data.remarks ?? null,
    data.priority ?? "medium",
    userId,
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  await recordStatusChange(result.insertId, null, "draft", userId, "Inspection created");
  return { id: result.insertId, inspection_no: inspectionNo };
};

// ─── SUBMIT INSPECTION (Draft -> Submitted, owner only) ────────────────────────
export const submitInspection = async (id: string, userId: number) => {
  const inspection = await assertInspectionExists(id);
  if (inspection.inspection_status !== "draft" && inspection.inspection_status !== "returned") {
    throw new Error(`Cannot submit an inspection in "${inspection.inspection_status}" state`);
  }
  if (inspection.inspector_id !== userId) {
    throw new Error("Only the inspector who created this inspection can submit it");
  }
  await pool.execute(`UPDATE inspections SET inspection_status = 'submitted', submitted_at = NOW() WHERE id = ?`, [id]);
  await recordStatusChange(Number(id), inspection.inspection_status, "submitted", userId, "Submitted for review");
  return { id: Number(id), inspection_status: "submitted" };
};

// ─── SUB-ADMIN: return to Inspector for correction (before assignment) ─────────
export const returnToInspector = async (id: string, userId: number, remarks?: string) => {
  const inspection = await assertInspectionExists(id);
  if (inspection.inspection_status !== "submitted") {
    throw new Error(`Cannot return an inspection that is "${inspection.inspection_status}"`);
  }
  await pool.execute(`UPDATE inspections SET inspection_status = 'returned' WHERE id = ?`, [id]);
  await recordStatusChange(Number(id), inspection.inspection_status, "returned", userId, remarks);
  return { id: Number(id), inspection_status: "returned" };
};

// ─── ADD DOCUMENTS (inspection evidence, or ATR uploads) ───────────────────────
export const addDocuments = async (
  inspectionId: number,
  files: Array<{ filename: string; originalname: string; size: number; mimetype: string }>,
  uploadedBy: number | null,
  documentType: "inspection" | "atr" | "other" = "inspection",
  atrId?: number
) => {
  for (const file of files) {
    await pool.execute(
      `INSERT INTO inspection_documents (inspection_id, atr_id, document_type, file_name, original_name, file_path, file_size, file_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inspectionId, atrId ?? null, documentType, file.filename, file.originalname, `/uploads/${file.filename}`, file.size, file.mimetype, uploadedBy]
    );
  }
};

export const deleteDocument = async (documentId: string) => {
  await pool.execute("UPDATE inspection_documents SET status = 0 WHERE id = ?", [documentId]);
  return { id: Number(documentId), deleted: true };
};

// ─── GET INSPECTIONS (list, filtered) ──────────────────────────────────────────
export interface InspectionFilters {
  search?: string;
  inspection_no?: string;
  division_id?: number;
  unit_id?: number;
  station_id?: number;
  train_id?: number;
  inspector_id?: number;
  assigned_to_user_id?: number;
  inspection_category_id?: number;
  inspection_type_id?: number;
  status?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

const buildInspectionWhere = (filters: InspectionFilters) => {
  const clauses = ["i.status = 1"];
  const params: any[] = [];

  if (filters.search) {
    clauses.push("(i.inspection_no LIKE ? OR i.inspecting_official_name LIKE ? OR i.observations LIKE ? OR i.deficiencies LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (filters.inspection_no) {
    clauses.push("i.inspection_no LIKE ?");
    params.push(`%${filters.inspection_no}%`);
  }
  if (filters.division_id) {
    clauses.push("i.division_id = ?");
    params.push(filters.division_id);
  }
  if (filters.unit_id) {
    clauses.push("i.unit_id = ?");
    params.push(filters.unit_id);
  }
  if (filters.station_id) {
    clauses.push("i.station_id = ?");
    params.push(filters.station_id);
  }
  if (filters.train_id) {
    clauses.push("i.train_id = ?");
    params.push(filters.train_id);
  }
  if (filters.inspector_id) {
    clauses.push("i.inspector_id = ?");
    params.push(filters.inspector_id);
  }
  if (filters.assigned_to_user_id) {
    clauses.push("i.assigned_to_user_id = ?");
    params.push(filters.assigned_to_user_id);
  }
  if (filters.inspection_category_id) {
    clauses.push("i.inspection_category_id = ?");
    params.push(filters.inspection_category_id);
  }
  if (filters.inspection_type_id) {
    clauses.push("i.inspection_type_id = ?");
    params.push(filters.inspection_type_id);
  }
  if (filters.status) {
    clauses.push("i.inspection_status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    clauses.push("i.priority = ?");
    params.push(filters.priority);
  }
  if (filters.date_from) {
    clauses.push("i.inspection_date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    clauses.push("i.inspection_date <= ?");
    params.push(filters.date_to);
  }

  return { whereSql: `WHERE ${clauses.join(" AND ")}`, params };
};

export const getInspections = async (filters: InspectionFilters) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const { whereSql, params } = buildInspectionWhere(filters);

  const countQuery = `SELECT COUNT(*) as total FROM inspections i ${whereSql}`;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, params);
  const total = countRows[0]?.total ?? 0;

  const query = `
    ${SELECT_INSPECTION_JOIN}
    ${whereSql}
    ORDER BY i.inspection_date DESC, i.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

export const getInspectionsForExport = async (filters: InspectionFilters) => {
  const { whereSql, params } = buildInspectionWhere(filters);
  const query = `${SELECT_INSPECTION_JOIN} ${whereSql} ORDER BY i.inspection_date DESC, i.id DESC`;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return rows;
};

// ─── GET INSPECTION BY ID (+ documents, assignments, ATRs, status history) ─────
export const getInspectionById = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(`${SELECT_INSPECTION_JOIN} WHERE i.id = ? AND i.status = 1`, [id]);
  const inspection = rows[0];
  if (!inspection) return null;

  const [documents] = await pool.execute<RowDataPacket[]>(
    `SELECT id, atr_id, document_type, file_name, original_name, file_path, file_size, file_type, uploaded_by, created_at
     FROM inspection_documents WHERE inspection_id = ? AND status = 1 ORDER BY created_at DESC`,
    [id]
  );

  const [assignments] = await pool.execute<RowDataPacket[]>(
    `SELECT ia.*, fu.unit_name as from_unit_name, tu.unit_name as to_unit_name, au.full_name as assigned_to_user_name, ab.full_name as assigned_by_name
     FROM inspection_assignments ia
     LEFT JOIN units fu ON fu.id = ia.from_unit_id
     LEFT JOIN units tu ON tu.id = ia.to_unit_id
     LEFT JOIN users au ON au.id = ia.assigned_to_user_id
     LEFT JOIN users ab ON ab.id = ia.assigned_by
     WHERE ia.inspection_id = ? ORDER BY ia.created_at DESC`,
    [id]
  );

  const [atrs] = await pool.execute<RowDataPacket[]>(
    `SELECT atr.*, sb.full_name as submitted_by_name, rb.full_name as reviewed_by_name, db.full_name as decided_by_name
     FROM inspection_action_taken_reports atr
     LEFT JOIN users sb ON sb.id = atr.submitted_by
     LEFT JOIN users rb ON rb.id = atr.reviewed_by
     LEFT JOIN users db ON db.id = atr.decided_by
     WHERE atr.inspection_id = ? AND atr.status = 1 ORDER BY atr.created_at DESC`,
    [id]
  );

  const [statusHistory] = await pool.execute<RowDataPacket[]>(
    `SELECT sh.*, u.full_name as changed_by_name FROM inspection_status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.inspection_id = ? ORDER BY sh.created_at ASC`,
    [id]
  );

  return { ...inspection, documents, assignments, atrs, statusHistory };
};

// ─── UPDATE INSPECTION (only while Draft/Returned, ownership enforced by caller) ─
export const editInspection = async (id: string, data: IInspectionUpdate) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields: Array<keyof IInspectionUpdate> = [
    "unit_id",
    "division_id",
    "station_id",
    "train_id",
    "inspecting_official_name",
    "designation",
    "place_of_posting",
    "inspection_category_id",
    "inspection_type_id",
    "inspection_date",
    "observations",
    "deficiencies",
    "recommendations",
    "remarks",
    "priority",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  if (updates.length === 0) {
    throw new Error("No fields provided to update");
  }

  values.push(id);
  await pool.execute(`UPDATE inspections SET ${updates.join(", ")} WHERE id = ?`, values);
  return { id, ...data };
};

export const deleteInspection = async (id: string) => {
  await pool.execute("UPDATE inspections SET status = 0 WHERE id = ?", [id]);
  return { id: Number(id), deleted: true };
};

// ─── GET INSPECTION METRICS (dashboard cards + charts) ─────────────────────────
export const getInspectionMetrics = async (divisionId?: number, inspectorId?: number, assignedToUserId?: number) => {
  const params: any[] = [];
  let whereSql = "i.status = 1";
  if (divisionId) {
    whereSql += " AND i.division_id = ?";
    params.push(divisionId);
  }
  if (inspectorId) {
    whereSql += " AND i.inspector_id = ?";
    params.push(inspectorId);
  }
  if (assignedToUserId) {
    whereSql += " AND i.assigned_to_user_id = ?";
    params.push(assignedToUserId);
  }

  const statsQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN inspection_status = 'submitted' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN inspection_status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
      SUM(CASE WHEN inspection_status IN ('atr_submitted','under_review') THEN 1 ELSE 0 END) as under_review_count,
      SUM(CASE WHEN inspection_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN inspection_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN inspection_status = 'closed' THEN 1 ELSE 0 END) as closed_count
    FROM inspections i
    WHERE ${whereSql}
  `;
  const [statsRows] = await pool.execute<RowDataPacket[]>(statsQuery, params);
  const stats = statsRows[0] || {};

  const [divisionWise] = await pool.execute<RowDataPacket[]>(
    `SELECT d.division_name, COUNT(*) as count FROM inspections i
     LEFT JOIN divisions d ON d.id = i.division_id
     WHERE ${whereSql} GROUP BY i.division_id, d.division_name`,
    params
  );

  const [unitWise] = await pool.execute<RowDataPacket[]>(
    `SELECT u.unit_name, COUNT(*) as count FROM inspections i
     LEFT JOIN units u ON u.id = i.unit_id
     WHERE ${whereSql} GROUP BY i.unit_id, u.unit_name
     ORDER BY count DESC LIMIT 10`,
    params
  );

  const [categoryWise] = await pool.execute<RowDataPacket[]>(
    `SELECT ic.label as inspection_category, COUNT(*) as count FROM inspections i
     LEFT JOIN dropdown_options ic ON ic.id = i.inspection_category_id
     WHERE ${whereSql} GROUP BY i.inspection_category_id, ic.label`,
    params
  );

  const [statusWise] = await pool.execute<RowDataPacket[]>(
    `SELECT inspection_status, COUNT(*) as count FROM inspections i WHERE ${whereSql} GROUP BY inspection_status`,
    params
  );

  const [inspectorWise] = await pool.execute<RowDataPacket[]>(
    `SELECT ins.full_name as inspector_name, COUNT(*) as count FROM inspections i
     LEFT JOIN users ins ON ins.id = i.inspector_id
     WHERE ${whereSql} GROUP BY i.inspector_id, ins.full_name
     ORDER BY count DESC LIMIT 10`,
    params
  );

  const [monthlyTrend] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(inspection_date, '%Y-%m') as month, COUNT(*) as count FROM inspections i
     WHERE ${whereSql} AND inspection_date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
     GROUP BY DATE_FORMAT(inspection_date, '%Y-%m') ORDER BY month ASC`,
    params
  );

  return {
    total: Number(stats.total ?? 0),
    pending: Number(stats.pending_count ?? 0),
    assigned: Number(stats.assigned_count ?? 0),
    atrPending: Number(stats.assigned_count ?? 0),
    underReview: Number(stats.under_review_count ?? 0),
    approved: Number(stats.approved_count ?? 0),
    rejected: Number(stats.rejected_count ?? 0),
    closed: Number(stats.closed_count ?? 0),
    divisionWise,
    unitWise,
    categoryWise,
    statusWise,
    inspectorWise,
    monthlyTrend,
  };
};
