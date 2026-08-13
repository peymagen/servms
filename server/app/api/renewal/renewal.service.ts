import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CREATE / SUBMIT RENEWAL ────────────────────────────────────────────────────
export const createRenewal = async (data: any, userId: number) => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT validity_end FROM vendors WHERE id = ? AND status = 1",
    [data.vendor_id]
  );
  if (vendorRows.length === 0) {
    throw new Error("Vendor not found");
  }

  const query = `
    INSERT INTO vendor_renewals (
      vendor_id, renewal_period, renewal_type, previous_expiry, new_expiry, medical_fitness_doc,
      medical_issue_date, medical_number, pvr_number, pvr_issue_date, pvr_document, renewals_status, submitted_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    data.vendor_id,
    data.renewal_period ?? "3 Years Extension (Standard)",
    data.renewal_type ?? "pvr",
    vendorRows[0].validity_end ?? null,
    data.new_expiry ?? null,
    data.medical_fitness_doc ?? null,
    data.medical_issue_date ?? null,
    data.medical_number ?? null,
    data.pvr_number ?? null,
    data.pvr_issue_date ?? null,
    data.pvr_document ?? null,
    data.renewals_status ?? "draft",
    userId,
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId };
};

// ─── GET RENEWALS ────────────────────────────────────────────────────────────────
export const getRenewals = async (filters: {
  division_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];

  const whereClauses = ["r.status = 1"];
  if (filters.division_id) {
    whereClauses.push("v.division_id = ?");
    params.push(filters.division_id);
  }
  if (filters.status) {
    whereClauses.push("r.renewals_status = ?");
    params.push(filters.status);
  }
  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM vendor_renewals r LEFT JOIN vendors v ON v.id = r.vendor_id ${whereSql}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT
      r.*,
      v.vendor_code, v.full_name, v.profile_image,
      d.division_name
    FROM vendor_renewals r
    LEFT JOIN vendors v ON v.id = r.vendor_id
    LEFT JOIN divisions d ON d.id = v.division_id
    ${whereSql}
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

// ─── GET RENEWAL BY ID ───────────────────────────────────────────────────────────
export const getRenewalById = async (id: string) => {
  const query = `
    SELECT r.*, v.vendor_code, v.full_name, v.profile_image, d.division_name
    FROM vendor_renewals r
    LEFT JOIN vendors v ON v.id = r.vendor_id
    LEFT JOIN divisions d ON d.id = v.division_id
    WHERE r.id = ? AND r.status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── UPDATE RENEWAL STATUS (APPROVE / REJECT) ───────────────────────────────────
export const updateRenewalStatus = async (id: string, status: string) => {
  await pool.execute(
    "UPDATE vendor_renewals SET renewals_status = ? WHERE id = ?",
    [status, id]
  );

  if (status === "approved") {
    const [renewalRows] = await pool.execute<RowDataPacket[]>(
      "SELECT vendor_id, new_expiry FROM vendor_renewals WHERE id = ?",
      [id]
    );
    const renewal = renewalRows[0];
    if (renewal?.vendor_id && renewal?.new_expiry) {
      await pool.execute(
        "UPDATE vendors SET validity_end = ?, vendor_status = 'active' WHERE id = ?",
        [renewal.new_expiry, renewal.vendor_id]
      );
    }
  }

  return { id, renewals_status: status };
};
