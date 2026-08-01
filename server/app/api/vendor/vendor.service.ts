import { pool, withTransaction } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type VendorDocumentType, type VerificationStatus } from "./vendor.dto";

// ─── VERIFICATION HELPERS ────────────────────────────────────────────────────────
// A verification is only ever "expired" for display purposes once its valid-till
// date has passed; we don't overwrite the admin-set status (verified/rejected/pending)
// in the database, so a rejected/pending record never gets silently relabelled.
const effectiveStatus = (status: string, validTill: string | Date | null): VerificationStatus => {
  if (status === "verified" && validTill) {
    const till = new Date(validTill);
    const today = new Date(new Date().toDateString());
    if (till < today) {
      return "expired";
    }
  }
  return status as VerificationStatus;
};

const withEffectiveVerification = <T extends Record<string, any>>(row: T): T => ({
  ...row,
  police_verification_status: effectiveStatus(row.police_verification_status, row.police_verification_valid_till),
  medical_verification_status: effectiveStatus(row.medical_verification_status, row.medical_verification_valid_till),
});

// ─── CREATE VENDOR ─────────────────────────────────────────────────────────────
export const createVendor = async (data: any, userId: number) => {
  // Generate random vendor code V-2026-XXXX
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const vendorCode = `V-2026-${randomNum}`;

  const query = `
    INSERT INTO vendors (
      vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, address,
      profile_image, signature_path, blood_group, vendor_type, contractor_id, unit_id, station_id, division_id, vendor_status,
      validity_start, validity_end,
      police_verification_status, police_verification_issue_date, police_verification_valid_till,
      police_verification_remarks, police_verification_document,
      medical_verification_status, medical_verification_issue_date, medical_verification_valid_till,
      medical_verification_remarks, medical_verification_document,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    vendorCode,
    data.full_name,
    data.father_name ?? null,
    data.date_of_birth ?? null,
    data.aadhaar_number ?? null,
    data.mobile_number ?? null,
    data.address ?? null,
    data.profile_image ?? null,
    data.signature_path ?? null,
    data.blood_group ?? null,
    data.vendor_type ?? "station_others",
    data.contractor_id ?? null,
    data.unit_id ?? null,
    data.station_id ?? null,
    data.division_id ?? null,
    data.vendor_status ?? "pending",
    data.validity_start ?? null,
    data.validity_end ?? null,
    data.police_verification_status ?? "pending",
    data.police_verification_issue_date ?? null,
    data.police_verification_valid_till ?? null,
    data.police_verification_remarks ?? null,
    data.police_verification_document ?? null,
    data.medical_verification_status ?? "pending",
    data.medical_verification_issue_date ?? null,
    data.medical_verification_valid_till ?? null,
    data.medical_verification_remarks ?? null,
    data.medical_verification_document ?? null,
    userId
  ];

  // Vendor row + auto-created ID card row + any onboarding documents must all land
  // together — wrapped in a transaction so a mid-way failure can't leave an orphaned
  // vendor with no card row or a partially-seeded document set.
  const insertId = await withTransaction(async (conn) => {
    const [result] = await conn.execute<ResultSetHeader>(query, values);
    const newId = result.insertId;

    await conn.execute(
      `INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newId,
        `CRIS-ID-${randomNum}`,
        `VMS-VERIFY-CODE-${vendorCode}`,
        data.validity_start ?? new Date().toISOString().split("T")[0],
        data.vendor_status === "active" ? "active" : "pending"
      ]
    );

    // Seed vendor_documents from any files uploaded during onboarding
    const initialDocs: Array<[VendorDocumentType, string | undefined, string | undefined]> = [
      ["AADHAAR", data.aadhaar_document, data.aadhaar_document_name],
      ["MEDICAL", data.medical_verification_document, data.medical_verification_document_name],
      ["POLICE_VERIFICATION", data.police_verification_document, data.police_verification_document_name],
    ];
    for (const [documentType, documentPath, originalName] of initialDocs) {
      if (documentPath) {
        await conn.execute(
          `INSERT INTO vendor_documents (vendor_id, document_type, document_path, original_name, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
          [newId, documentType, documentPath, originalName ?? null, userId]
        );
      }
    }

    return newId;
  });

  return { id: insertId, vendor_code: vendorCode };
};

// ─── STATUS CHANGE (dedicated action so it's a distinct, gated audit event) ─────
export const changeVendorStatus = async (id: string, status: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT vendor_status FROM vendors WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows[0]) throw new Error("Vendor not found");
  const previousStatus = rows[0].vendor_status;

  await pool.execute("UPDATE vendors SET vendor_status = ? WHERE id = ?", [status, id]);
  return { id: Number(id), previousStatus, newStatus: status };
};

// ─── GET VENDORS (WITH SEARCH AND FILTERS) ───────────────────────────────────────
export const getVendors = async (filters: {
  search?: string;
  division_id?: number;
  unit_id?: number;
  status?: string;
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

  if (filters.status === "inactive") {
    // "Inactive" isn't a single stored status — it's the Dashboard module's
    // rollup of every non-active, non-blacklisted status. Keep in sync with
    // dashboard.service.ts's getVendorsSummary if that definition changes.
    whereClauses.push("v.vendor_status NOT IN ('active','blacklisted')");
  } else if (filters.status) {
    whereClauses.push("v.vendor_status = ?");
    params.push(filters.status);
    countParams.push(filters.status);
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
    LIMIT ${Number.isInteger(limit) ? limit : 10} OFFSET ${Number.isInteger(offset) ? offset : 0}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows: rows.map(withEffectiveVerification) };
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
  return rows[0] ? withEffectiveVerification(rows[0]) : null;
};

// ─── EDIT VENDOR (PATCH) ─────────────────────────────────────────────────────────
export const editVendor = async (id: string, data: any) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields = [
    "full_name", "father_name", "date_of_birth", "aadhaar_number", "mobile_number",
    "address", "profile_image", "signature_path", "blood_group", "emergency_contact", "vendor_type",
    "contractor_id", "unit_id", "station_id", "division_id", "vendor_status",
    "validity_start", "validity_end",
    "police_verification_status", "police_verification_issue_date", "police_verification_valid_till",
    "police_verification_remarks", "police_verification_document",
    "medical_verification_status", "medical_verification_issue_date", "medical_verification_valid_till",
    "medical_verification_remarks", "medical_verification_document"
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

// ─── TRANSFER: UNIT ──────────────────────────────────────────────────────────────
export const transferUnit = async (id: string, unitId: number) => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT unit_id FROM vendors WHERE id = ? AND status = 1",
    [id]
  );
  if (!vendorRows[0]) throw new Error("Vendor not found");

  const [unitRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, station_id FROM units u WHERE id = ?",
    [unitId]
  );
  if (!unitRows[0]) throw new Error("Unit not found");

  const [stationRows] = await pool.execute<RowDataPacket[]>(
    "SELECT division_id FROM stations WHERE id = ?",
    [unitRows[0].station_id]
  );

  const previousUnitId = vendorRows[0].unit_id;
  await pool.execute(
    "UPDATE vendors SET unit_id = ?, station_id = ?, division_id = ? WHERE id = ?",
    [unitId, unitRows[0].station_id ?? null, stationRows[0]?.division_id ?? null, id]
  );

  return { id: Number(id), previous_unit_id: previousUnitId, new_unit_id: unitId };
};

// ─── TRANSFER: CONTRACTOR ─────────────────────────────────────────────────────────
export const transferContractor = async (id: string, contractorId: number) => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT contractor_id FROM vendors WHERE id = ? AND status = 1",
    [id]
  );
  if (!vendorRows[0]) throw new Error("Vendor not found");

  const [contractorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM contractors WHERE id = ? AND status = 1",
    [contractorId]
  );
  if (!contractorRows[0]) throw new Error("Contractor not found");

  const previousContractorId = vendorRows[0].contractor_id;
  await pool.execute("UPDATE vendors SET contractor_id = ? WHERE id = ?", [contractorId, id]);

  return { id: Number(id), previous_contractor_id: previousContractorId, new_contractor_id: contractorId };
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
      SUM(CASE WHEN police_verification_status = 'verified'
               AND (police_verification_valid_till IS NULL OR police_verification_valid_till >= CURDATE())
          THEN 1 ELSE 0 END) as police_verified,
      SUM(CASE WHEN medical_verification_status = 'expired'
               OR (medical_verification_status = 'verified' AND medical_verification_valid_till < CURDATE())
          THEN 1 ELSE 0 END) as expired_medicals,
      SUM(CASE WHEN police_verification_status = 'expired'
               OR (police_verification_status = 'verified' AND police_verification_valid_till < CURDATE())
          THEN 1 ELSE 0 END) as expired_pvr,
      SUM(CASE WHEN (medical_verification_status = 'verified' AND medical_verification_valid_till IS NOT NULL
                     AND medical_verification_valid_till BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))
               OR (police_verification_status = 'verified' AND police_verification_valid_till IS NOT NULL
                     AND police_verification_valid_till BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))
          THEN 1 ELSE 0 END) as expiring_soon,
      SUM(CASE WHEN vendor_status = 'pending' THEN 1 ELSE 0 END) as awaiting_approval
    FROM vendors
    WHERE ${whereSql}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  const stats = rows[0] || {};

  return {
    totalActiveVendors: Number(stats.active ?? 0),
    policeVerified: Number(stats.police_verified ?? 0),
    expiredMedicals: Number(stats.expired_medicals ?? 0),
    expiredPvr: Number(stats.expired_pvr ?? 0),
    expiringSoon: Number(stats.expiring_soon ?? 0),
    awaitingApproval: Number(stats.awaiting_approval ?? 0)
  };
};

// ─── GET VENDOR VERIFICATION DETAILS ─────────────────────────────────────────────
export const getVendorVerification = async (id: string) => {
  const query = `
    SELECT
      id, vendor_code, full_name,
      police_verification_status, police_verification_issue_date, police_verification_valid_till,
      police_verification_remarks, police_verification_document,
      medical_verification_status, medical_verification_issue_date, medical_verification_valid_till,
      medical_verification_remarks, medical_verification_document
    FROM vendors
    WHERE id = ? AND status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ? withEffectiveVerification(rows[0]) : null;
};

// ─── UPDATE POLICE / MEDICAL VERIFICATION ────────────────────────────────────────
const updateVerification = async (
  id: string,
  prefix: "police_verification" | "medical_verification",
  data: { status?: string; issue_date?: string; valid_till?: string; remarks?: string },
  documentPath?: string
) => {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.status !== undefined) {
    updates.push(`\`${prefix}_status\` = ?`);
    values.push(data.status);
  }
  if (data.issue_date !== undefined) {
    updates.push(`\`${prefix}_issue_date\` = ?`);
    values.push(data.issue_date);
  }
  if (data.valid_till !== undefined) {
    updates.push(`\`${prefix}_valid_till\` = ?`);
    values.push(data.valid_till);
  }
  if (data.remarks !== undefined) {
    updates.push(`\`${prefix}_remarks\` = ?`);
    values.push(data.remarks);
  }
  if (documentPath) {
    updates.push(`\`${prefix}_document\` = ?`);
    values.push(documentPath);
  }

  if (updates.length === 0) {
    throw new Error("No updateable verification fields provided");
  }

  values.push(id);
  await pool.execute(`UPDATE vendors SET ${updates.join(", ")} WHERE id = ?`, values);

  return getVendorVerification(id);
};

export const updatePoliceVerification = (
  id: string,
  data: { status?: string; issue_date?: string; valid_till?: string; remarks?: string },
  documentPath?: string
) => updateVerification(id, "police_verification", data, documentPath);

export const updateMedicalVerification = (
  id: string,
  data: { status?: string; issue_date?: string; valid_till?: string; remarks?: string },
  documentPath?: string
) => updateVerification(id, "medical_verification", data, documentPath);

// ─── VENDOR DOCUMENTS ─────────────────────────────────────────────────────────────
export const getVendorDocuments = async (vendorId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT vd.*, u.full_name as uploaded_by_name
     FROM vendor_documents vd
     LEFT JOIN users u ON u.id = vd.uploaded_by
     WHERE vd.vendor_id = ? AND vd.status = 1
     ORDER BY vd.uploaded_at DESC`,
    [vendorId]
  );
  return rows;
};

export const uploadVendorDocument = async (
  vendorId: string,
  documentType: VendorDocumentType,
  documentPath: string,
  userId: number,
  originalName?: string
) => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM vendors WHERE id = ? AND status = 1",
    [vendorId]
  );
  if (vendorRows.length === 0) {
    throw new Error("Vendor not found");
  }

  // Replace semantics: retire any existing active document of the same type first.
  await pool.execute(
    "UPDATE vendor_documents SET status = 0 WHERE vendor_id = ? AND document_type = ? AND status = 1",
    [vendorId, documentType]
  );

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO vendor_documents (vendor_id, document_type, document_path, original_name, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
    [vendorId, documentType, documentPath, originalName ?? null, userId]
  );

  // Keep the vendor's own verification-document column in sync for the two verification types.
  if (documentType === "POLICE_VERIFICATION") {
    await pool.execute("UPDATE vendors SET police_verification_document = ? WHERE id = ?", [documentPath, vendorId]);
  } else if (documentType === "MEDICAL") {
    await pool.execute("UPDATE vendors SET medical_verification_document = ? WHERE id = ?", [documentPath, vendorId]);
  }

  return { id: result.insertId, vendor_id: Number(vendorId), document_type: documentType, document_path: documentPath };
};

export const deleteVendorDocument = async (vendorId: string, documentId: string) => {
  await pool.execute(
    "UPDATE vendor_documents SET status = 0 WHERE id = ? AND vendor_id = ?",
    [documentId, vendorId]
  );
  return { id: Number(documentId), deleted: true };
};
