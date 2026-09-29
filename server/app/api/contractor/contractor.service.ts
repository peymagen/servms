import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import createHttpError from "http-errors";

// ─── GENERATE NEXT CONTRACTOR CODE ─────────────────────────────────────────────
// Uses the highest numeric suffix ever issued (soft-deleted rows included, so a
// code is never reused) rather than whichever row happens to be newest.
const generateContractorCode = async (): Promise<string> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT MAX(CAST(SUBSTRING_INDEX(contractor_code, '-', -1) AS UNSIGNED)) AS last_num FROM contractors"
  );
  const nextNum = Number(rows[0]?.last_num ?? 0) + 1;
  return `CON-${String(nextNum).padStart(3, "0")}`;
};

const isContractorCodeCollision = (err: any): boolean =>
  err?.code === "ER_DUP_ENTRY" && String(err?.message ?? "").includes("contractor_code");

// contract_end_date is derived (award_date + tenure_months) and read by the
// Dashboard's contract-expiry alerts — recomputed in SQL after every create/edit
// so it can never drift from the two fields it's based on.
const syncContractEndDate = async (id: number | string) => {
  await pool.execute(
    `UPDATE contractors
     SET contract_end_date = IF(award_date IS NOT NULL AND tenure_months IS NOT NULL,
                                DATE_ADD(award_date, INTERVAL tenure_months MONTH), NULL)
     WHERE id = ?`,
    [id]
  );
};

// ─── CREATE CONTRACTOR ──────────────────────────────────────────────────────────
// New contractors always start as pending_approval — any other status goes through
// changeContractorStatus (approve_reject permission), never through create/edit.
export const createContractor = async (data: any, userId: number) => {
  const query = `
    INSERT INTO contractors (
      contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email,
      registered_address, pan_number, gstin, epf_registration, license_number, license_validity_date,
      annual_registration_fee, irctc_licensed, logo_image, division_id, contractors_status, fee_status,
      joined_date, award_date, tenure_months, annual_contract_value, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Two simultaneous onboardings can compute the same next code; the unique key
  // rejects the second insert, so retry it with a freshly computed code.
  for (let attempt = 1; ; attempt++) {
    const contractorCode = await generateContractorCode();
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
      data.irctc_licensed === true || data.irctc_licensed === "true" || data.irctc_licensed === "1" ? 1 : 0,
      data.logo_image ?? null,
      data.division_id ?? null,
      "pending_approval",
      data.fee_status ?? "paid",
      new Date().toISOString().split("T")[0],
      data.award_date ?? null,
      data.tenure_months ?? null,
      data.annual_contract_value ?? null,
      userId,
    ];

    try {
      const [result] = await pool.execute<ResultSetHeader>(query, values);
      await syncContractEndDate(result.insertId);
      return { id: result.insertId, contractor_code: contractorCode };
    } catch (err) {
      if (attempt < 5 && isContractorCodeCollision(err)) continue;
      throw err;
    }
  }
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

  if (filters.status === "inactive") {
    // "Inactive" isn't a single stored status — it's the Dashboard module's
    // rollup of every non-active, non-blacklisted status. Keep in sync with
    // dashboard.service.ts's getContractorsSummary if that definition changes.
    whereClauses.push("c.contractors_status NOT IN ('active','blacklisted')");
  } else if (filters.status) {
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
    "division_id", "fee_status", "compliance_rate", "penalty_index",
    "award_date", "tenure_months", "annual_contract_value",
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
    throw createHttpError(400, "No updateable fields provided");
  }

  values.push(id);
  const query = `UPDATE contractors SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  await syncContractEndDate(id);
  return { ...data, id };
};

// ─── DELETE CONTRACTOR ───────────────────────────────────────────────────────────
// Blocked while units or vendors still point at this contractor — soft-deleting it
// would leave them attached to a contractor that no longer appears anywhere.
export const deleteContractor = async (id: string) => {
  const [linkRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM units WHERE contractor_id = ?) AS unit_count,
       (SELECT COUNT(*) FROM vendors WHERE contractor_id = ? AND status = 1) AS vendor_count`,
    [id, id]
  );
  const unitCount = Number(linkRows[0]?.unit_count ?? 0);
  const vendorCount = Number(linkRows[0]?.vendor_count ?? 0);
  if (unitCount > 0 || vendorCount > 0) {
    throw createHttpError(
      409,
      `Cannot delete: ${unitCount} unit(s) and ${vendorCount} vendor(s) are still linked to this contractor. Unlink or transfer them first.`
    );
  }
  await pool.execute("UPDATE contractors SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};

// ─── STATUS CHANGE (dedicated action so it's a distinct, gated audit event) ─────
export const changeContractorStatus = async (id: string, status: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT contractors_status FROM contractors WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows[0]) throw createHttpError(404, "Contractor not found");
  const previousStatus = rows[0].contractors_status;

  await pool.execute("UPDATE contractors SET contractors_status = ? WHERE id = ?", [status, id]);
  return { id: Number(id), previousStatus, newStatus: status };
};

// ─── UNIT LINKING (multiple units per contractor via units.contractor_id) ───────
// Units can sit on a station, a train, or a cluster — resolve the display name and
// division from whichever one is set (same COALESCE as unit.service.ts's DIVISION_EXPR).
const UNIT_LOCATION_JOINS = `
  LEFT JOIN stations st ON st.id = u.station_id
  LEFT JOIN trains tr ON tr.id = u.train_id
  LEFT JOIN location_clusters cl ON cl.id = u.cluster_id
`;

export const getContractorUnits = async (contractorId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.unit_code, u.unit_name, u.location_type, u.station_id, st.station_name,
            COALESCE(st.station_name, CONCAT(tr.train_number, ' - ', tr.train_name), cl.cluster_name) AS location_name,
            COALESCE(st.division_id, tr.division_id, cl.division_id) AS division_id,
            u.units_status
     FROM units u
     ${UNIT_LOCATION_JOINS}
     WHERE u.contractor_id = ?
     ORDER BY u.unit_name ASC`,
    [contractorId]
  );
  return rows;
};

export const assignUnit = async (contractorId: string, unitId: number, contractorDivisionId: number | null) => {
  const [unitRows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.unit_name, u.contractor_id,
            COALESCE(st.division_id, tr.division_id, cl.division_id) AS division_id
     FROM units u
     ${UNIT_LOCATION_JOINS}
     WHERE u.id = ?`,
    [unitId]
  );
  const unit = unitRows[0];
  if (!unit) throw createHttpError(404, "Unit not found");
  if (unit.contractor_id && Number(unit.contractor_id) !== Number(contractorId)) {
    throw createHttpError(409, "This unit is already linked to a different contractor");
  }
  if (
    contractorDivisionId != null &&
    unit.division_id != null &&
    Number(unit.division_id) !== Number(contractorDivisionId)
  ) {
    throw createHttpError(400, "This unit belongs to a different division than the contractor");
  }

  await pool.execute("UPDATE units SET contractor_id = ? WHERE id = ?", [contractorId, unitId]);
  return { unit_id: unitId, contractor_id: Number(contractorId), previous_contractor_id: unit.contractor_id };
};

export const unassignUnit = async (contractorId: string, unitId: number) => {
  const [unitRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, contractor_id FROM units WHERE id = ? AND contractor_id = ?",
    [unitId, contractorId]
  );
  if (!unitRows[0]) throw createHttpError(404, "Unit is not linked to this contractor");

  await pool.execute("UPDATE units SET contractor_id = NULL WHERE id = ?", [unitId]);
  return { unit_id: unitId, previous_contractor_id: Number(contractorId) };
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
