import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CREATE COMPLAINT ─────────────────────────────────────────────────────────
export const createComplaint = async (data: any, userId: number) => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const complaintCode = `CMP-${randomNum}`;

  const query = `
    INSERT INTO complaints (
      complaint_code, unit_id, location_text, category, description,
      occurrence_date, occurrence_time, priority, complaints_status, registered_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    complaintCode,
    data.unit_id,
    data.location_text ?? "Platform Area",
    data.category,
    data.description,
    data.occurrence_date ?? new Date().toISOString().split("T")[0],
    data.occurrence_time ?? new Date().toTimeString().split(" ")[0],
    data.priority ?? "medium",
    data.complaints_status ?? "open",
    userId
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId, complaint_code: complaintCode };
};

// ─── ADD EVIDENCE FILES ────────────────────────────────────────────────────────
export const addEvidence = async (
  complaintId: number,
  files: Array<{ path: string; type: string }>
) => {
  for (const file of files) {
    await pool.execute(
      `INSERT INTO complaint_evidence (complaint_id, file_path, file_type) VALUES (?, ?, ?)`,
      [complaintId, file.path, file.type]
    );
  }
};

// ─── GET COMPLAINTS ───────────────────────────────────────────────────────────
export const getComplaints = async (filters: {
  search?: string;
  division_id?: number;
  unit_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  const params: any[] = [];
  const countParams: any[] = [];

  let whereClauses = ["c.status = 1"];

  if (filters.search) {
    whereClauses.push("(c.complaint_code LIKE ? OR c.category LIKE ? OR c.description LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (filters.division_id) {
    // Join stations/units to filter by division
    whereClauses.push("st.division_id = ?");
    params.push(filters.division_id);
    countParams.push(filters.division_id);
  }

  if (filters.unit_id) {
    whereClauses.push("c.unit_id = ?");
    params.push(filters.unit_id);
    countParams.push(filters.unit_id);
  }

  if (filters.status) {
    whereClauses.push("c.complaints_status = ?");
    params.push(filters.status);
    countParams.push(filters.status);
  }

  if (filters.date_from) {
    whereClauses.push("c.occurrence_date >= ?");
    params.push(filters.date_from);
    countParams.push(filters.date_from);
  }

  if (filters.date_to) {
    whereClauses.push("c.occurrence_date <= ?");
    params.push(filters.date_to);
    countParams.push(filters.date_to);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM complaints c
    LEFT JOIN units u ON u.id = c.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    ${whereSql}
  `;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
  const total = countRows[0]?.total ?? 0;

  // Get rows
  const query = `
    SELECT 
      c.*,
      u.unit_name,
      st.station_name,
      d.division_name,
      us.full_name as registered_by_name
    FROM complaints c
    LEFT JOIN units u ON u.id = c.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN divisions d ON d.id = st.division_id
    LEFT JOIN users us ON us.id = c.registered_by
    ${whereSql}
    ORDER BY c.occurrence_date DESC, c.occurrence_time DESC
    LIMIT ${Number.isInteger(limit) ? limit : 10} OFFSET ${Number.isInteger(offset) ? offset : 0}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

// ─── GET COMPLAINT BY ID ───────────────────────────────────────────────────────
export const getComplaintById = async (id: string) => {
  const query = `
    SELECT 
      c.*,
      u.unit_name,
      st.station_name,
      d.division_name,
      us.full_name as registered_by_name
    FROM complaints c
    LEFT JOIN units u ON u.id = c.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN divisions d ON d.id = st.division_id
    LEFT JOIN users us ON us.id = c.registered_by
    WHERE c.id = ? AND c.status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  const complaint = rows[0];
  if (!complaint) return null;

  const [evidenceRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, file_path, file_type, uploaded_at FROM complaint_evidence WHERE complaint_id = ? AND status = 1",
    [id]
  );

  return { ...complaint, evidence: evidenceRows };
};

// ─── UPDATE COMPLAINT (PATCH) ──────────────────────────────────────────────────
export const editComplaint = async (id: string, data: any) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields = ["complaints_status", "priority", "description", "category", "location_text", "resolution_date"];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  if (
    (data.complaints_status === "resolved" || data.complaints_status === "rejected") &&
    !data.resolution_date
  ) {
    updates.push("resolution_date = ?");
    values.push(new Date().toISOString().split("T")[0]);
  }

  if (updates.length === 0) {
    throw new Error("No fields provided to update");
  }

  values.push(id);
  const query = `UPDATE complaints SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── GET COMPLAINTS METRICS ─────────────────────────────────────────────────────
export const getComplaintMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  const distParams: any[] = [];
  let whereSql = "c.status = 1";

  if (divisionId) {
    whereSql += " AND st.division_id = ?";
    params.push(divisionId);
    distParams.push(divisionId);
  }

  const statsQuery = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN complaints_status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN complaints_status = 'investigating' THEN 1 ELSE 0 END) as investigating_count,
      SUM(CASE WHEN complaints_status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
    FROM complaints c
    LEFT JOIN units u ON u.id = c.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    WHERE ${whereSql}
  `;

  const [statsRows] = await pool.execute<RowDataPacket[]>(statsQuery, params);
  const stats = statsRows[0] || {};

  // Group by category for chart distribution
  const distQuery = `
    SELECT 
      category,
      COUNT(*) as count
    FROM complaints c
    LEFT JOIN units u ON u.id = c.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    WHERE ${whereSql}
    GROUP BY category
  `;

  const [distRows] = await pool.execute<RowDataPacket[]>(distQuery, distParams);

  return {
    openComplaints: Number(stats.open_count ?? 0),
    pendingATR: Number(stats.investigating_count ?? 0),
    avgResolutionTime: 42.5, // Standard hours based on target
    categoryDistribution: distRows
  };
};
