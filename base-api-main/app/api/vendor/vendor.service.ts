import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CREATE VENDOR ─────────────────────────────────────────────────────────────
export const createVendor = async (data: any, userId: number) => {
  // Generate random vendor code V-2026-XXXX
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const vendorCode = `V-2026-${randomNum}`;

  const query = `
    INSERT INTO vendors (
      vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, email,
      profile_image, vendor_type, contractor_id, unit_id, station_id, division_id, vendor_status,
      validity_start, validity_end, police_verification_status, police_verification_number, police_verification_date,
      medical_fitness_status, medical_fitness_doc, aadhar_linked, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    vendorCode,
    data.full_name,
    data.father_name ?? null,
    data.date_of_birth ?? null,
    data.aadhaar_number ?? null,
    data.mobile_number ?? null,
    data.email ?? null,
    data.profile_image ?? null,
    data.vendor_type ?? "stationary",
    data.contractor_id ?? null,
    data.unit_id ?? null,
    data.station_id ?? null,
    data.division_id ?? null,
    data.vendor_status ?? "pending",
    data.validity_start ?? null,
    data.validity_end ?? null,
    data.police_verification_status ?? "pending",
    data.police_verification_number ?? null,
    data.police_verification_date ?? null,
    data.medical_fitness_status ?? "pending",
    data.medical_fitness_doc ?? null,
    data.aadhar_linked ?? 0,
    userId
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  const insertId = result.insertId;

  // Auto create ID Card for new vendor
  await pool.execute(
    `INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status) 
     VALUES (?, ?, ?, ?, ?)`,
    [
      insertId,
      `CRIS-ID-${randomNum}`,
      `VMS-VERIFY-CODE-${vendorCode}`,
      data.validity_start ?? new Date().toISOString().split("T")[0],
      data.vendor_status === "active" ? "active" : "pending"
    ]
  );

  return { id: insertId, vendor_code: vendorCode };
};

// ─── GET VENDORS (WITH SEARCH AND FILTERS) ───────────────────────────────────────
export const getVendors = async (filters: {
  search?: string;
  division_id?: number;
  unit_id?: number;
  status?: string;
  aadhaar_status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  const params: any[] = [];
  const countParams: any[] = [];

  let whereClauses = ["v.status = 1"];

  if (filters.search) {
    whereClauses.push("(v.full_name LIKE ? OR v.vendor_code LIKE ? OR c.company_name LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (filters.division_id) {
    whereClauses.push("v.division_id = ?");
    params.push(filters.division_id);
    countParams.push(filters.division_id);
  }

  if (filters.unit_id) {
    whereClauses.push("v.unit_id = ?");
    params.push(filters.unit_id);
    countParams.push(filters.unit_id);
  }

  if (filters.status) {
    whereClauses.push("v.vendor_status = ?");
    params.push(filters.status);
    countParams.push(filters.status);
  }

  if (filters.aadhaar_status) {
    if (filters.aadhaar_status === "verified") {
      whereClauses.push("v.aadhar_linked = 1");
    } else if (filters.aadhaar_status === "pending") {
      whereClauses.push("v.aadhar_linked = 0");
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM vendors v
    LEFT JOIN contractors c ON c.id = v.contractor_id
    ${whereSql}
  `;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
  const total = countRows[0]?.total ?? 0;

  // Get rows
  const query = `
    SELECT 
      v.*,
      c.company_name as contractor_name,
      u.unit_name,
      s.station_name,
      d.division_name,
      ic.id_number as card_number,
      ic.cards_status as card_status
    FROM vendors v
    LEFT JOIN contractors c ON c.id = v.contractor_id
    LEFT JOIN units u ON u.id = v.unit_id
    LEFT JOIN stations s ON s.id = v.station_id
    LEFT JOIN divisions d ON d.id = v.division_id
    LEFT JOIN vendor_id_cards ic ON ic.vendor_id = v.id
    ${whereSql}
    ORDER BY v.created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

// ─── GET VENDOR BY ID ────────────────────────────────────────────────────────────
export const getVendorById = async (id: string) => {
  const query = `
    SELECT 
      v.*,
      c.company_name as contractor_name,
      u.unit_name,
      s.station_name,
      d.division_name,
      ic.id_number as card_number,
      ic.cards_status as card_status
    FROM vendors v
    LEFT JOIN contractors c ON c.id = v.contractor_id
    LEFT JOIN units u ON u.id = v.unit_id
    LEFT JOIN stations s ON s.id = v.station_id
    LEFT JOIN divisions d ON d.id = v.division_id
    LEFT JOIN vendor_id_cards ic ON ic.vendor_id = v.id
    WHERE v.id = ? AND v.status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── EDIT VENDOR (PATCH) ─────────────────────────────────────────────────────────
export const editVendor = async (id: string, data: any) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields = [
    "full_name", "father_name", "date_of_birth", "aadhaar_number", "mobile_number",
    "email", "profile_image", "blood_group", "emergency_contact", "vendor_type",
    "contractor_id", "unit_id", "station_id", "division_id", "vendor_status",
    "validity_start", "validity_end", "police_verification_status", "police_verification_number",
    "police_verification_date", "medical_fitness_status", "medical_fitness_doc", "aadhar_linked"
  ];

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
  const query = `UPDATE vendors SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);

  // Sync card status if status updated
  if (data.vendor_status) {
    await pool.execute(
      "UPDATE vendor_id_cards SET cards_status = ? WHERE vendor_id = ?",
      [data.vendor_status === "active" ? "active" : "expired", id]
    );
  }

  return { id, ...data };
};

// ─── DELETE VENDOR ───────────────────────────────────────────────────────────────
export const deleteVendor = async (id: string) => {
  await pool.execute("UPDATE vendors SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};

// ─── GET VENDOR METRICS ─────────────────────────────────────────────────────────
export const getVendorMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "status = 1";

  if (divisionId) {
    whereSql += " AND division_id = ?";
    params.push(divisionId);
  }

  const query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN vendor_status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN aadhar_linked = 1 THEN 1 ELSE 0 END) as aadhaar_verified,
      SUM(CASE WHEN vendor_status = 'expired' OR validity_end < CURDATE() THEN 1 ELSE 0 END) as expired_medicals,
      SUM(CASE WHEN vendor_status = 'pending' THEN 1 ELSE 0 END) as awaiting_approval
    FROM vendors
    WHERE ${whereSql}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  const stats = rows[0] || {};

  return {
    totalActiveVendors: Number(stats.active ?? 0),
    aadhaarVerified: Number(stats.aadhaar_verified ?? 0),
    expiredMedicals: Number(stats.expired_medicals ?? 0),
    awaitingApproval: Number(stats.awaiting_approval ?? 0)
  };
};
