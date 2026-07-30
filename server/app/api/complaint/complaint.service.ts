import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type IComplaintCreate, type IComplaintUpdate } from "./complaint.dto";

const SELECT_COMPLAINT_JOIN = `
  SELECT
    c.*,
    u.unit_name,
    st.station_name,
    d.division_name,
    t.train_name, t.train_number,
    ct.label AS complaint_type_label,
    cst.label AS complaint_subtype_label,
    us.full_name AS registered_by_name,
    au.full_name AS assigned_to_user_name,
    cu.full_name AS closed_by_name
  FROM complaints c
  LEFT JOIN units u ON u.id = c.unit_id
  LEFT JOIN stations st ON st.id = COALESCE(c.station_id, u.station_id)
  LEFT JOIN divisions d ON d.id = c.division_id
  LEFT JOIN trains t ON t.id = c.train_id
  LEFT JOIN dropdown_options ct ON ct.id = c.complaint_type_id
  LEFT JOIN dropdown_options cst ON cst.id = c.complaint_subtype_id
  LEFT JOIN users us ON us.id = c.registered_by
  LEFT JOIN users au ON au.id = c.assigned_to_user_id
  LEFT JOIN users cu ON cu.id = c.closed_by
`;

const generateComplaintCode = () => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `CMP-${randomNum}`;
};

// Manual/CPGRAMS entries derive their dedup reference number from whichever
// source-specific field was supplied — RailMadad's own reference number is
// handled separately by the import service.
const deriveManualRefNo = (source: "cpgrams" | "manual", data: IComplaintCreate): string | null => {
  if (source === "cpgrams") return data.portal_registration_number?.trim() || null;
  return data.manual_dak_reference_number?.trim() || data.eoffice_computer_number?.trim() || null;
};

export const getUnitDivisionId = async (unitId: number): Promise<number | null> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT st.division_id FROM units u LEFT JOIN stations st ON st.id = u.station_id WHERE u.id = ?`,
    [unitId]
  );
  return rows[0]?.division_id ?? null;
};

export const recordStatusChange = async (
  complaintId: number,
  fromStatus: string | null,
  toStatus: string,
  changedBy: number | null,
  remarks?: string
) => {
  await pool.execute(
    `INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
    [complaintId, fromStatus, toStatus, changedBy, remarks ?? null]
  );
};

// ─── CREATE COMPLAINT (Manual / CPGRAMS) ───────────────────────────────────────
export const createComplaint = async (data: IComplaintCreate, userId: number) => {
  const complaintCode = generateComplaintCode();
  const source = data.complaint_source ?? "manual";
  const refNo = deriveManualRefNo(source, data);

  let divisionId = data.division_id ?? null;
  if (!divisionId) {
    divisionId = await getUnitDivisionId(data.unit_id);
  }

  const query = `
    INSERT INTO complaints (
      complaint_code, complaint_source, complaint_ref_no, portal_registration_number,
      manual_dak_reference_number, eoffice_computer_number,
      unit_id, division_id, train_id, station_id,
      location_text, complaint_type_id, complaint_subtype_id, description,
      complainant_name, complainant_mobile, complainant_email,
      occurrence_date, occurrence_time, complaint_date,
      priority, complaints_status, registered_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const now = new Date();
  const values = [
    complaintCode,
    source,
    refNo,
    data.portal_registration_number ?? null,
    data.manual_dak_reference_number ?? null,
    data.eoffice_computer_number ?? null,
    data.unit_id,
    divisionId,
    data.train_id ?? null,
    data.station_id ?? null,
    data.location_text ?? null,
    data.complaint_type_id,
    data.complaint_subtype_id,
    data.description,
    data.complainant_name ?? null,
    data.complainant_mobile ?? null,
    data.complainant_email ?? null,
    data.occurrence_date ?? now.toISOString().split("T")[0],
    data.occurrence_time ?? now.toTimeString().split(" ")[0],
    data.complaint_date ?? now,
    data.priority ?? "medium",
    "pending",
    userId,
  ];

  try {
    const [result] = await pool.execute<ResultSetHeader>(query, values);
    await recordStatusChange(result.insertId, null, "pending", userId, "Complaint registered");
    return { id: result.insertId, complaint_code: complaintCode };
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      throw new Error(`A complaint with this reference number already exists for ${source.toUpperCase()}`);
    }
    throw err;
  }
};

// ─── ADD DOCUMENTS (evidence at creation, or ATR uploads) ──────────────────────
export const addDocuments = async (
  complaintId: number,
  files: Array<{ filename: string; originalname: string; path: string; mimetype: string }>,
  uploadedBy: number | null,
  documentType: "evidence" | "atr" | "other" = "evidence",
  atrId?: number
) => {
  for (const file of files) {
    await pool.execute(
      `INSERT INTO complaint_documents (complaint_id, atr_id, document_type, file_name, original_name, file_path, file_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [complaintId, atrId ?? null, documentType, file.filename, file.originalname, `/uploads/${file.filename}`, file.mimetype, uploadedBy]
    );
  }
};

// ─── GET COMPLAINTS (list, filtered) ───────────────────────────────────────────
export interface ComplaintFilters {
  search?: string;
  complaint_ref_no?: string;
  complaint_source?: string;
  division_id?: number;
  unit_id?: number;
  station_id?: number;
  train_id?: number;
  complaint_type_id?: number;
  complaint_subtype_id?: number;
  status?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

const buildComplaintWhere = (filters: ComplaintFilters) => {
  const clauses = ["c.status = 1"];
  const params: any[] = [];

  if (filters.search) {
    clauses.push(
      "(c.complaint_code LIKE ? OR c.complaint_ref_no LIKE ? OR c.description LIKE ? OR c.complainant_name LIKE ? OR c.complainant_mobile LIKE ?)"
    );
    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term);
  }
  if (filters.complaint_ref_no) {
    clauses.push("c.complaint_ref_no LIKE ?");
    params.push(`%${filters.complaint_ref_no}%`);
  }
  if (filters.complaint_source) {
    clauses.push("c.complaint_source = ?");
    params.push(filters.complaint_source);
  }
  if (filters.division_id) {
    clauses.push("c.division_id = ?");
    params.push(filters.division_id);
  }
  if (filters.unit_id) {
    clauses.push("c.unit_id = ?");
    params.push(filters.unit_id);
  }
  if (filters.station_id) {
    clauses.push("c.station_id = ?");
    params.push(filters.station_id);
  }
  if (filters.train_id) {
    clauses.push("c.train_id = ?");
    params.push(filters.train_id);
  }
  if (filters.complaint_type_id) {
    clauses.push("c.complaint_type_id = ?");
    params.push(filters.complaint_type_id);
  }
  if (filters.complaint_subtype_id) {
    clauses.push("c.complaint_subtype_id = ?");
    params.push(filters.complaint_subtype_id);
  }
  if (filters.status) {
    clauses.push("c.complaints_status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    clauses.push("c.priority = ?");
    params.push(filters.priority);
  }
  if (filters.date_from) {
    clauses.push("DATE(c.complaint_date) >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    clauses.push("DATE(c.complaint_date) <= ?");
    params.push(filters.date_to);
  }

  return { whereSql: `WHERE ${clauses.join(" AND ")}`, params };
};

export const getComplaints = async (filters: ComplaintFilters) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const { whereSql, params } = buildComplaintWhere(filters);

  const countQuery = `SELECT COUNT(*) as total FROM complaints c ${whereSql}`;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, params);
  const total = countRows[0]?.total ?? 0;

  const query = `
    ${SELECT_COMPLAINT_JOIN}
    ${whereSql}
    ORDER BY c.complaint_date DESC, c.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

// Same filter set, uncapped (used by Excel/CSV export) — caller is responsible
// for capping via filters.limit if needed.
export const getComplaintsForExport = async (filters: ComplaintFilters) => {
  const { whereSql, params } = buildComplaintWhere(filters);
  const query = `${SELECT_COMPLAINT_JOIN} ${whereSql} ORDER BY c.complaint_date DESC, c.id DESC`;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return rows;
};

// ─── GET COMPLAINT BY ID (+ documents, assignment history, ATRs, status history) ─
export const getComplaintById = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(`${SELECT_COMPLAINT_JOIN} WHERE c.id = ? AND c.status = 1`, [id]);
  const complaint = rows[0];
  if (!complaint) return null;

  const [documents] = await pool.execute<RowDataPacket[]>(
    `SELECT id, atr_id, document_type, file_name, original_name, file_path, file_type, uploaded_by, created_at
     FROM complaint_documents WHERE complaint_id = ? AND status = 1 ORDER BY created_at DESC`,
    [id]
  );

  const [assignments] = await pool.execute<RowDataPacket[]>(
    `SELECT ca.*, fu.unit_name as from_unit_name, tu.unit_name as to_unit_name, au.full_name as assigned_to_user_name, ab.full_name as assigned_by_name
     FROM complaint_assignments ca
     LEFT JOIN units fu ON fu.id = ca.from_unit_id
     LEFT JOIN units tu ON tu.id = ca.to_unit_id
     LEFT JOIN users au ON au.id = ca.assigned_to_user_id
     LEFT JOIN users ab ON ab.id = ca.assigned_by
     WHERE ca.complaint_id = ? ORDER BY ca.created_at DESC`,
    [id]
  );

  const [atrs] = await pool.execute<RowDataPacket[]>(
    `SELECT atr.*, sb.full_name as submitted_by_name, rb.full_name as reviewed_by_name, db.full_name as decided_by_name
     FROM complaint_action_taken_reports atr
     LEFT JOIN users sb ON sb.id = atr.submitted_by
     LEFT JOIN users rb ON rb.id = atr.reviewed_by
     LEFT JOIN users db ON db.id = atr.decided_by
     WHERE atr.complaint_id = ? AND atr.status = 1 ORDER BY atr.created_at DESC`,
    [id]
  );

  const [statusHistory] = await pool.execute<RowDataPacket[]>(
    `SELECT sh.*, u.full_name as changed_by_name FROM complaint_status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.complaint_id = ? ORDER BY sh.created_at ASC`,
    [id]
  );

  return { ...complaint, documents, assignments, atrs, statusHistory };
};

// ─── UPDATE COMPLAINT (PATCH — core fields only, not workflow status) ──────────
export const editComplaint = async (id: string, data: IComplaintUpdate) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields: Array<keyof IComplaintUpdate> = [
    "location_text",
    "complaint_type_id",
    "complaint_subtype_id",
    "description",
    "priority",
    "complainant_name",
    "complainant_mobile",
    "complainant_email",
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
  await pool.execute(`UPDATE complaints SET ${updates.join(", ")} WHERE id = ?`, values);
  return { id, ...data };
};

// ─── GET COMPLAINT METRICS (dashboard cards + charts) ──────────────────────────
export const getComplaintMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "c.status = 1";
  if (divisionId) {
    whereSql += " AND c.division_id = ?";
    params.push(divisionId);
  }

  const statsQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN complaints_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN complaints_status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
      SUM(CASE WHEN complaints_status = 'under_review' THEN 1 ELSE 0 END) as under_review_count,
      SUM(CASE WHEN complaints_status = 'action_taken' THEN 1 ELSE 0 END) as action_taken_count,
      SUM(CASE WHEN complaints_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN complaints_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN complaints_status = 'closed' THEN 1 ELSE 0 END) as closed_count,
      SUM(CASE WHEN DATE(complaint_date) = CURDATE() THEN 1 ELSE 0 END) as today_count,
      SUM(CASE WHEN YEAR(complaint_date) = YEAR(CURDATE()) AND MONTH(complaint_date) = MONTH(CURDATE()) THEN 1 ELSE 0 END) as this_month_count
    FROM complaints c
    WHERE ${whereSql}
  `;
  const [statsRows] = await pool.execute<RowDataPacket[]>(statsQuery, params);
  const stats = statsRows[0] || {};

  const [divisionWise] = await pool.execute<RowDataPacket[]>(
    `SELECT d.division_name, COUNT(*) as count FROM complaints c
     LEFT JOIN divisions d ON d.id = c.division_id
     WHERE ${whereSql} GROUP BY c.division_id, d.division_name`,
    params
  );

  const [typeWise] = await pool.execute<RowDataPacket[]>(
    `SELECT ct.label as complaint_type, COUNT(*) as count FROM complaints c
     LEFT JOIN dropdown_options ct ON ct.id = c.complaint_type_id
     WHERE ${whereSql} GROUP BY c.complaint_type_id, ct.label`,
    params
  );

  const [statusWise] = await pool.execute<RowDataPacket[]>(
    `SELECT complaints_status, COUNT(*) as count FROM complaints c WHERE ${whereSql} GROUP BY complaints_status`,
    params
  );

  const [monthlyTrend] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(complaint_date, '%Y-%m') as month, COUNT(*) as count FROM complaints c
     WHERE ${whereSql} AND complaint_date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
     GROUP BY DATE_FORMAT(complaint_date, '%Y-%m') ORDER BY month ASC`,
    params
  );

  return {
    total: Number(stats.total ?? 0),
    pending: Number(stats.pending_count ?? 0),
    assigned: Number(stats.assigned_count ?? 0),
    underReview: Number(stats.under_review_count ?? 0),
    actionTaken: Number(stats.action_taken_count ?? 0),
    approved: Number(stats.approved_count ?? 0),
    rejected: Number(stats.rejected_count ?? 0),
    closed: Number(stats.closed_count ?? 0),
    today: Number(stats.today_count ?? 0),
    thisMonth: Number(stats.this_month_count ?? 0),
    // Backward-compatible fields consumed by the existing Reports page summary.
    openComplaints: Number(stats.pending_count ?? 0),
    pendingATR: Number(stats.action_taken_count ?? 0),
    divisionWise,
    typeWise,
    statusWise,
    monthlyTrend,
  };
};
