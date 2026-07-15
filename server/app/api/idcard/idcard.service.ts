import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── GET ALL ID CARDS (WITH VENDOR INFO) ────────────────────────────────────────
export const getIdCards = async (filters: {
  search?: string;
  division_id?: number;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];

  const whereClauses = ["v.status = 1"];
  if (filters.search) {
    whereClauses.push("(v.full_name LIKE ? OR v.vendor_code LIKE ? OR ic.id_number LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.division_id) {
    whereClauses.push("v.division_id = ?");
    params.push(filters.division_id);
  }
  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM vendors v LEFT JOIN vendor_id_cards ic ON ic.vendor_id = v.id ${whereSql}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT
      v.id as vendor_id, v.vendor_code, v.full_name, v.vendor_type, v.profile_image,
      v.validity_start, v.validity_end, v.police_verification_status, v.medical_fitness_status, v.aadhar_linked,
      c.company_name as contractor_name,
      u.unit_name, st.station_name, d.division_name,
      ic.id, ic.id_number, ic.qr_code_data, ic.issued_date, ic.cards_status, ic.last_checked_at
    FROM vendors v
    LEFT JOIN units u ON u.id = v.unit_id
    LEFT JOIN stations st ON st.id = v.station_id
    LEFT JOIN divisions d ON d.id = v.division_id
    LEFT JOIN contractors c ON c.id = v.contractor_id
    LEFT JOIN vendor_id_cards ic ON ic.vendor_id = v.id
    ${whereSql}
    ORDER BY v.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

// ─── ISSUE / REISSUE ID CARD ────────────────────────────────────────────────────
export const issueIdCard = async (vendorId: string) => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM vendors WHERE id = ? AND status = 1",
    [vendorId]
  );
  const vendor = vendorRows[0];
  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const [existingRows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM vendor_id_cards WHERE vendor_id = ?",
    [vendorId]
  );

  const issuedDate = new Date().toISOString().split("T")[0];
  const qrCodeData = `VMS-VERIFY-CODE-${vendor.vendor_code}`;

  if (existingRows.length > 0) {
    await pool.execute(
      `UPDATE vendor_id_cards
       SET cards_status = 'active', issued_date = ?, qr_code_data = ?, last_checked_at = NOW()
       WHERE vendor_id = ?`,
      [issuedDate, qrCodeData, vendorId]
    );
    return { vendor_id: vendorId, id_number: existingRows[0].id_number, reissued: true };
  }

  const idNumber = `CRIS-ID-${vendor.vendor_code.replace(/\D/g, "")}`;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status)
     VALUES (?, ?, ?, ?, 'active')`,
    [vendorId, idNumber, qrCodeData, issuedDate]
  );

  return { id: result.insertId, vendor_id: vendorId, id_number: idNumber, reissued: false };
};

// ─── PUBLIC QR VERIFICATION (NO AUTH) ───────────────────────────────────────────
export const verifyIdCard = async (idNumberOrCode: string) => {
  const query = `
    SELECT
      v.vendor_code, v.full_name, v.vendor_type, v.validity_start, v.validity_end,
      v.police_verification_status, v.medical_fitness_status, v.aadhar_linked,
      c.company_name as contractor_name,
      u.unit_name, st.station_name,
      ic.id_number, ic.qr_code_data, ic.cards_status, ic.issued_date, ic.last_checked_at
    FROM vendor_id_cards ic
    JOIN vendors v ON v.id = ic.vendor_id
    LEFT JOIN contractors c ON c.id = v.contractor_id
    LEFT JOIN units u ON u.id = v.unit_id
    LEFT JOIN stations st ON st.id = v.station_id
    WHERE ic.id_number = ? OR ic.qr_code_data = ?
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [idNumberOrCode, idNumberOrCode]);
  const card = rows[0];
  if (!card) {
    return null;
  }

  await pool.execute(
    "UPDATE vendor_id_cards SET last_checked_at = NOW() WHERE id_number = ?",
    [card.id_number]
  );

  return card;
};
