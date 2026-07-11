import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── GENERATE NEXT CONTRACTOR CODE ─────────────────────────────────────────────
const generateContractorCode = async (): Promise<string> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT contractor_code FROM contractors ORDER BY id DESC LIMIT 1"
  );
  const last = rows[0]?.contractor_code as string | undefined;
  const lastNum = last ? Number(last.split("-")[1] ?? 0) : 0;
  const nextNum = lastNum + 1;
  return `CON-${String(nextNum).padStart(3, "0")}`;
};

// ─── CREATE CONTRACTOR ──────────────────────────────────────────────────────────
export const createContractor = async (data: any, userId: number) => {
  const contractorCode = await generateContractorCode();

  const query = `
    INSERT INTO contractors (
      contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email,
      registered_address, pan_number, gstin, epf_registration, license_number, license_validity_date,
      annual_registration_fee, irctc_licensed, logo_image, division_id, contractors_status, fee_status,
      joined_date, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    contractorCode,
    data.company_name,
    data.primary_contact_name ?? null,
    data.primary_contact_mobile ?? null,
    data.official_email ?? null,
    data.registered_address ?? null,
    data.pan_number ?? null,
    data.gstin ?? null,
    data.epf_registration ?? null,
    data.license_number ?? null,
    data.license_validity_date ?? null,
    data.annual_registration_fee ?? 0,
    data.irctc_licensed ? 1 : 0,
    data.logo_image ?? null,
    data.division_id ?? null,
    data.contractors_status ?? "pending_approval",
    data.fee_status ?? "paid",
    new Date().toISOString().split("T")[0],
    userId,
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId, contractor_code: contractorCode };
};

// ─── GET CONTRACTORS (WITH SEARCH, FILTERS & PAGINATION) ───────────────────────
export const getContractors = async (filters: {
  search?: string;
  division_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];
  const countParams: any[] = [];

  const whereClauses = ["c.status = 1"];

  if (filters.search) {
    whereClauses.push("(c.company_name LIKE ? OR c.contractor_code LIKE ? OR c.license_number LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
    countParams.push(term, term, term);
  }

  if (filters.division_id) {
    whereClauses.push("c.division_id = ?");
    params.push(filters.division_id);
    countParams.push(filters.division_id);
  }

  if (filters.status) {
    whereClauses.push("c.contractors_status = ?");
    params.push(filters.status);
    countParams.push(filters.status);
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const countQuery = `SELECT COUNT(*) as total FROM contractors c ${whereSql}`;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT
      c.*,
      d.division_name,
      (SELECT COUNT(*) FROM vendors v WHERE v.contractor_id = c.id AND v.status = 1) as vendor_count
    FROM contractors c
    LEFT JOIN divisions d ON d.id = c.division_id
    ${whereSql}
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

// ─── GET CONTRACTOR BY ID ───────────────────────────────────────────────────────
export const getContractorById = async (id: string) => {
  const query = `
    SELECT
      c.*,
      d.division_name,
      (SELECT COUNT(*) FROM vendors v WHERE v.contractor_id = c.id AND v.status = 1) as vendor_count,
      (SELECT COUNT(*) FROM units u WHERE u.contractor_id = c.id) as unit_count
    FROM contractors c
    LEFT JOIN divisions d ON d.id = c.division_id
    WHERE c.id = ? AND c.status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── EDIT CONTRACTOR (PATCH) ─────────────────────────────────────────────────────
export const editContractor = async (id: string, data: any) => {
  const allowedFields = [
    "company_name", "primary_contact_name", "primary_contact_mobile", "official_email",
    "registered_address", "pan_number", "gstin", "epf_registration", "license_number",
    "license_validity_date", "annual_registration_fee", "irctc_licensed", "logo_image",
    "division_id", "contractors_status", "fee_status", "compliance_rate", "penalty_index",
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
  const query = `UPDATE contractors SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── DELETE CONTRACTOR ───────────────────────────────────────────────────────────
export const deleteContractor = async (id: string) => {
  await pool.execute("UPDATE contractors SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};

// ─── GET CONTRACTOR METRICS ─────────────────────────────────────────────────────
export const getContractorMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "status = 1";
  if (divisionId) {
    whereSql += " AND division_id = ?";
    params.push(divisionId);
  }

  const query = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN contractors_status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN license_validity_date IS NOT NULL AND license_validity_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) AND license_validity_date >= CURDATE() THEN 1 ELSE 0 END) as expiring_soon,
      SUM(CASE WHEN fee_status = 'overdue' THEN 1 ELSE 0 END) as fees_overdue
    FROM contractors
    WHERE ${whereSql}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  const stats = rows[0] ?? {};

  const vendorCountParams: any[] = [];
  let vendorWhereSql = "v.status = 1";
  if (divisionId) {
    vendorWhereSql += " AND v.division_id = ?";
    vendorCountParams.push(divisionId);
  }
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total_vendors FROM vendors v WHERE ${vendorWhereSql}`,
    vendorCountParams
  );

  return {
    totalActive: Number(stats.active ?? 0),
    expiringSoon: Number(stats.expiring_soon ?? 0),
    feesOverdue: Number(stats.fees_overdue ?? 0),
    totalVendors: Number(vendorRows[0]?.total_vendors ?? 0),
  };
};
