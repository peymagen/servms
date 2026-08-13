import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import {
  RECOVERY_STATUS_ORDER,
  type IPenaltyApprove,
  type IPenaltyCreate,
  type IPenaltyFilters,
  type IPenaltyRecoveryUpdate,
  type IPenaltyRecoveryVerify,
  type IPenaltyUpdate,
  type PenaltyApprovalStatus,
  type PenaltyDocumentType,
  type PenaltyRecoveryStatus,
} from "./penalty.dto";

const BASE_JOINS = `
  FROM penalties p
  LEFT JOIN contractors c ON c.id = p.contractor_id
  LEFT JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN units u ON u.id = p.unit_id
  LEFT JOIN stations st ON st.id = u.station_id
  LEFT JOIN complaints cm ON cm.id = p.complaint_id
  LEFT JOIN inspections ins ON ins.id = p.inspection_id
  LEFT JOIN divisions d ON d.id = COALESCE(c.division_id, v.division_id, st.division_id)
  LEFT JOIN users us ON us.id = p.issued_by
  LEFT JOIN users appu ON appu.id = p.approved_by
  LEFT JOIN users revu ON revu.id = p.revoked_by
  LEFT JOIN users vfu ON vfu.id = p.recovery_verified_by
`;

const SELECT_COLUMNS = `
  p.*,
  c.company_name as contractor_name,
  v.full_name as vendor_name,
  u.unit_name,
  st.station_name,
  d.id as division_id,
  d.division_name,
  us.full_name as issued_by_name,
  appu.full_name as approved_by_name,
  revu.full_name as revoked_by_name,
  vfu.full_name as recovery_verified_by_name,
  cm.complaint_code,
  ins.inspection_date
`;

// Keeps the legacy 3-state `penalties_status` column in sync from the new
// approval/recovery workflow so existing consumers (dashboard.service.ts) keep working.
function deriveLegacyStatus(
  approvalStatus: PenaltyApprovalStatus,
  recoveryStatus: PenaltyRecoveryStatus
): "pending" | "recovered" | "waived" {
  if (approvalStatus === "rejected" || approvalStatus === "revoked") return "waived";
  if (recoveryStatus === "recovered" || recoveryStatus === "closed") return "recovered";
  return "pending";
}

// ─── CREATE PENALTY ────────────────────────────────────────────────────────────
export const createPenalty = async (data: IPenaltyCreate, userId: number) => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const penaltyCode = `PNL-${new Date().getFullYear()}-${randomNum}`;
  const issuedDate = data.issued_date ?? new Date().toISOString().split("T")[0];
  const legacyStatus = deriveLegacyStatus("pending_approval", "pending");

  const query = `
    INSERT INTO penalties (
      penalty_code, reference_type, complaint_id, inspection_id,
      contractor_id, vendor_id, unit_id, amount, reason,
      penalties_status, approval_status, recovery_status, due_date,
      issued_by, issued_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', 'pending', ?, ?, ?)
  `;

  const values = [
    penaltyCode,
    data.reference_type ?? null,
    data.complaint_id ?? null,
    data.inspection_id ?? null,
    data.contractor_id,
    data.vendor_id ?? null,
    data.unit_id ?? null,
    data.amount,
    data.reason,
    legacyStatus,
    data.due_date ?? null,
    userId,
    issuedDate,
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId, penalty_code: penaltyCode };
};

// ─── GET PENALTIES (WITH SEARCH AND FILTERS) ─────────────────────────────────────
export const getPenalties = async (filters: IPenaltyFilters) => {
  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  const params: any[] = [];

  const whereClauses = ["p.status = 1"];

  if (filters.search) {
    whereClauses.push("(p.penalty_code LIKE ? OR p.reason LIKE ? OR c.company_name LIKE ? OR v.full_name LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (filters.division_id) {
    whereClauses.push("COALESCE(c.division_id, v.division_id, st.division_id) = ?");
    params.push(filters.division_id);
  }
  if (filters.contractor_id) {
    whereClauses.push("p.contractor_id = ?");
    params.push(filters.contractor_id);
  }
  if (filters.vendor_id) {
    whereClauses.push("p.vendor_id = ?");
    params.push(filters.vendor_id);
  }
  if (filters.approval_status) {
    whereClauses.push("p.approval_status = ?");
    params.push(filters.approval_status);
  }
  if (filters.recovery_status) {
    whereClauses.push("p.recovery_status = ?");
    params.push(filters.recovery_status);
  }
  if (filters.penalty_date_from) {
    whereClauses.push("p.issued_date >= ?");
    params.push(filters.penalty_date_from);
  }
  if (filters.penalty_date_to) {
    whereClauses.push("p.issued_date <= ?");
    params.push(filters.penalty_date_to);
  }
  if (filters.due_date_from) {
    whereClauses.push("p.due_date >= ?");
    params.push(filters.due_date_from);
  }
  if (filters.due_date_to) {
    whereClauses.push("p.due_date <= ?");
    params.push(filters.due_date_to);
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const countQuery = `SELECT COUNT(*) as total ${BASE_JOINS} ${whereSql}`;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, params);
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT ${SELECT_COLUMNS}
    ${BASE_JOINS}
    ${whereSql}
    ORDER BY p.issued_date DESC, p.created_at DESC
    LIMIT ${Number.isInteger(limit) ? limit : 10} OFFSET ${Number.isInteger(offset) ? offset : 0}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

// ─── GET PENALTY BY ID ───────────────────────────────────────────────────────────
export const getPenaltyById = async (id: string) => {
  const query = `
    SELECT ${SELECT_COLUMNS}
    ${BASE_JOINS}
    WHERE p.id = ? AND p.status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  const penalty = rows[0] ?? null;
  if (!penalty) return null;

  const [documents] = await pool.execute<RowDataPacket[]>(
    `SELECT pd.id, pd.penalty_id, pd.document_type, pd.document_path, pd.original_name,
            pd.uploaded_by, u.full_name as uploaded_by_name, pd.uploaded_at
     FROM penalty_documents pd
     LEFT JOIN users u ON u.id = pd.uploaded_by
     WHERE pd.penalty_id = ? AND pd.status = 1 ORDER BY pd.uploaded_at DESC`,
    [id]
  );

  return { ...penalty, documents };
};

const assertExists = async (id: string): Promise<RowDataPacket> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM penalties WHERE id = ? AND status = 1`,
    [id]
  );
  if (!rows[0]) throw new Error("Penalty record not found");
  return rows[0];
};

// ─── UPDATE PENALTY (basic fields — amount/reason/due date/remarks) ──────────────
export const editPenalty = async (id: string, data: IPenaltyUpdate) => {
  await assertExists(id);
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields: Array<keyof IPenaltyUpdate> = ["amount", "reason", "due_date", "remarks"];
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
  await pool.execute(`UPDATE penalties SET ${updates.join(", ")} WHERE id = ?`, values);
  return getPenaltyById(id);
};

// ─── APPROVE / REJECT / REVOKE (Divisional/HQ Admin only, gated at route level) ──
// Amount is already captured at creation; due date/order number/remarks are
// captured here, at the moment of approval/imposition, rather than only being
// settable later via editPenalty/updateRecovery — approved_at (set below) IS the
// Penalty Imposition Date/timestamp.
export const approvePenalty = async (id: string, userId: number, data: IPenaltyApprove = {}) => {
  const penalty = await assertExists(id);
  if (penalty.approval_status !== "pending_approval") {
    throw new Error(`Cannot approve a penalty in "${penalty.approval_status}" state`);
  }
  const legacyStatus = deriveLegacyStatus("approved", penalty.recovery_status);

  const updates = ["approval_status = 'approved'", "approved_by = ?", "approved_at = NOW()", "penalties_status = ?"];
  const values: any[] = [userId, legacyStatus];

  const optionalFields: Array<keyof IPenaltyApprove> = ["due_date", "order_number", "order_date", "remarks"];
  for (const field of optionalFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  values.push(id);
  await pool.execute(`UPDATE penalties SET ${updates.join(", ")} WHERE id = ?`, values);
  return getPenaltyById(id);
};

export const rejectPenalty = async (id: string, userId: number, reason?: string) => {
  const penalty = await assertExists(id);
  if (penalty.approval_status !== "pending_approval") {
    throw new Error(`Cannot reject a penalty in "${penalty.approval_status}" state`);
  }
  const legacyStatus = deriveLegacyStatus("rejected", penalty.recovery_status);
  await pool.execute(
    `UPDATE penalties SET approval_status = 'rejected', approved_by = ?, approved_at = NOW(), revoke_reason = ?, penalties_status = ? WHERE id = ?`,
    [userId, reason ?? null, legacyStatus, id]
  );
  return getPenaltyById(id);
};

export const revokePenalty = async (id: string, userId: number, reason: string) => {
  const penalty = await assertExists(id);
  if (penalty.approval_status !== "approved") {
    throw new Error(`Only an approved penalty can be revoked (current state: "${penalty.approval_status}")`);
  }
  const legacyStatus = deriveLegacyStatus("revoked", penalty.recovery_status);
  await pool.execute(
    `UPDATE penalties SET approval_status = 'revoked', revoked_by = ?, revoked_at = NOW(), revoke_reason = ?, penalties_status = ? WHERE id = ?`,
    [userId, reason, legacyStatus, id]
  );
  return getPenaltyById(id);
};

// ─── RECOVERY ENTRY (Dealing Section): Pending → Partially Recovered → Recovered ─
// "Closed" is deliberately NOT reachable from here — reaching "recovered" only
// records that Dealing Section believes the full amount is in; an Admin/Divisional
// Admin must separately verify the recovery documents (see verifyRecovery below)
// before the penalty is actually closed out, per the Document Verification step.
export const updateRecovery = async (id: string, data: IPenaltyRecoveryUpdate) => {
  const penalty = await assertExists(id);
  if (penalty.approval_status !== "approved") {
    throw new Error("Recovery can only be tracked on an approved penalty");
  }

  if (data.recovery_status === "closed") {
    throw new Error(
      "Recovery entry cannot close a penalty directly — mark it \"recovered\" and have an Admin verify it instead"
    );
  }

  const currentIndex = RECOVERY_STATUS_ORDER.indexOf(penalty.recovery_status);
  const nextIndex = RECOVERY_STATUS_ORDER.indexOf(data.recovery_status);
  if (nextIndex === -1) {
    throw new Error("Invalid recovery status");
  }
  if (nextIndex < currentIndex) {
    throw new Error(
      `Recovery status cannot move backward from "${penalty.recovery_status}" to "${data.recovery_status}"`
    );
  }

  const recoveryAmount = data.recovery_amount ?? penalty.recovery_amount;
  if (recoveryAmount < 0 || recoveryAmount > Number(penalty.amount)) {
    throw new Error("Recovery amount must be between 0 and the penalty amount");
  }
  if (data.recovery_status === "partially_recovered" && recoveryAmount <= 0) {
    throw new Error("Recovery amount is required when marking a penalty as partially recovered");
  }
  if (data.recovery_status === "recovered" && recoveryAmount < Number(penalty.amount)) {
    throw new Error("Recovery amount must equal the full penalty amount to mark it as recovered");
  }

  const legacyStatus = deriveLegacyStatus(penalty.approval_status, data.recovery_status);
  const recoveryDate =
    data.recovery_date ??
    (["recovered", "partially_recovered"].includes(data.recovery_status)
      ? new Date().toISOString().split("T")[0]
      : penalty.recovery_date);

  const updates: string[] = [
    "recovery_status = ?",
    "recovery_amount = ?",
    "recovery_date = ?",
    "penalties_status = ?",
  ];
  const values: any[] = [data.recovery_status, recoveryAmount, recoveryDate, legacyStatus];

  // Reaching (or re-reaching, after a rejected verification) "recovered" always
  // (re)opens a fresh verification cycle — clears any prior verifier/decision.
  if (data.recovery_status === "recovered") {
    updates.push("recovery_verification_status = 'pending'", "recovery_verified_by = NULL", "recovery_verified_at = NULL");
  }

  const optionalFields: Array<keyof IPenaltyRecoveryUpdate> = [
    "payment_reference",
    "mr_number",
    "mr_date",
    "order_number",
    "order_date",
    "remarks",
  ];
  for (const field of optionalFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  values.push(id);
  await pool.execute(`UPDATE penalties SET ${updates.join(", ")} WHERE id = ?`, values);
  return getPenaltyById(id);
};

// ─── DOCUMENT VERIFICATION (Admin/Divisional Admin): Recovered → Closed ─────────
export const verifyRecovery = async (id: string, userId: number, data: IPenaltyRecoveryVerify) => {
  const penalty = await assertExists(id);
  if (penalty.recovery_status !== "recovered") {
    throw new Error('Only a penalty marked "recovered" by Dealing Section can be verified');
  }
  if (penalty.recovery_verification_status !== "pending") {
    throw new Error("This recovery entry has already been decided — no verification is pending");
  }

  if (data.decision === "verified") {
    const legacyStatus = deriveLegacyStatus(penalty.approval_status, "closed");
    await pool.execute(
      `UPDATE penalties SET
        recovery_verification_status = 'verified', recovery_verified_by = ?, recovery_verified_at = NOW(),
        recovery_status = 'closed', penalties_status = ?, resolution_date = COALESCE(resolution_date, CURDATE()),
        remarks = COALESCE(?, remarks)
       WHERE id = ?`,
      [userId, legacyStatus, data.remarks ?? null, id]
    );
  } else {
    // Rejected: recovery_status stays "recovered" — Dealing Section must correct
    // the entry/documents and resubmit via updateRecovery, which re-opens verification.
    await pool.execute(
      `UPDATE penalties SET
        recovery_verification_status = 'rejected', recovery_verified_by = ?, recovery_verified_at = NOW(),
        remarks = COALESCE(?, remarks)
       WHERE id = ?`,
      [userId, data.remarks ?? null, id]
    );
  }

  return getPenaltyById(id);
};

// ─── SUPPORTING DOCUMENTS ────────────────────────────────────────────────────────
export const uploadPenaltyDocument = async (
  penaltyId: string,
  documentType: PenaltyDocumentType,
  documentPath: string,
  originalName: string | undefined,
  userId: number
) => {
  await assertExists(penaltyId);
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO penalty_documents (penalty_id, document_type, document_path, original_name, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
    [penaltyId, documentType, documentPath, originalName ?? null, userId]
  );
  return { id: result.insertId, penalty_id: Number(penaltyId), document_type: documentType, document_path: documentPath };
};

// ─── GET PENALTY METRICS (dashboard totals + aging buckets) ─────────────────────
export const getPenaltyMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "p.status = 1 AND p.approval_status = 'approved'";

  if (divisionId) {
    whereSql += " AND COALESCE(c.division_id, v.division_id, st.division_id) = ?";
    params.push(divisionId);
  }

  const totalsQuery = `
    SELECT
      COUNT(*) as total_cases,
      SUM(amount) as total_imposed,
      SUM(CASE WHEN recovery_status IN ('recovered','closed') THEN amount ELSE recovery_amount END) as total_recovered,
      SUM(CASE WHEN recovery_status IN ('recovered','closed') THEN 0 ELSE amount - recovery_amount END) as total_outstanding,
      SUM(CASE WHEN recovery_status IN ('pending','partially_recovered') AND due_date IS NOT NULL AND due_date < CURDATE() THEN amount - recovery_amount ELSE 0 END) as overdue_amount,
      SUM(CASE WHEN recovery_status IN ('pending','partially_recovered') AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) as overdue_count
    ${BASE_JOINS}
    WHERE ${whereSql}
  `;
  const [totalsRows] = await pool.execute<RowDataPacket[]>(totalsQuery, params);
  const stats = totalsRows[0] || {};

  const totalImposed = Number(stats.total_imposed ?? 0);
  const totalRecovered = Number(stats.total_recovered ?? 0);
  const recoveryRate = totalImposed > 0 ? (totalRecovered / totalImposed) * 100 : 0;

  // Pending-category aging buckets (7/14/30/30+ days) — measured from due_date.
  const bucketQuery = `
    SELECT
      SUM(CASE WHEN DATEDIFF(due_date, CURDATE()) BETWEEN 0 AND 7 THEN 1 ELSE 0 END) as within_7,
      SUM(CASE WHEN DATEDIFF(due_date, CURDATE()) BETWEEN 8 AND 14 THEN 1 ELSE 0 END) as within_14,
      SUM(CASE WHEN DATEDIFF(due_date, CURDATE()) BETWEEN 15 AND 30 THEN 1 ELSE 0 END) as within_30,
      SUM(CASE WHEN DATEDIFF(due_date, CURDATE()) < 0 OR DATEDIFF(due_date, CURDATE()) > 30 THEN 1 ELSE 0 END) as over_30
    ${BASE_JOINS}
    WHERE ${whereSql} AND p.recovery_status IN ('pending','partially_recovered') AND p.due_date IS NOT NULL
  `;
  const [bucketRows] = await pool.execute<RowDataPacket[]>(bucketQuery, params);
  const buckets = bucketRows[0] || {};

  const alertQuery = `
    SELECT p.penalty_code, c.company_name as contractor_name, p.amount, p.reason, p.issued_date, p.due_date
    ${BASE_JOINS}
    WHERE ${whereSql} AND p.recovery_status IN ('pending','partially_recovered')
    ORDER BY p.amount DESC, p.issued_date ASC
    LIMIT 5
  `;
  const [alerts] = await pool.execute<RowDataPacket[]>(alertQuery, params);

  return {
    totalCases: Number(stats.total_cases ?? 0),
    totalImposed,
    totalRecovered,
    outstandingAmount: Number(stats.total_outstanding ?? 0),
    overdueAmount: Number(stats.overdue_amount ?? 0),
    overdueCount: Number(stats.overdue_count ?? 0),
    recoveryRate: Math.round(recoveryRate * 10) / 10,
    pendingCategories: {
      within7Days: Number(buckets.within_7 ?? 0),
      within14Days: Number(buckets.within_14 ?? 0),
      within30Days: Number(buckets.within_30 ?? 0),
      over30Days: Number(buckets.over_30 ?? 0),
    },
    alerts,
  };
};

// ─── NOTIFICATION FEEDS (upcoming due / overdue / recovered) ────────────────────
export const getPenaltyNotificationRows = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "p.status = 1 AND p.approval_status = 'approved'";
  if (divisionId) {
    whereSql += " AND COALESCE(c.division_id, v.division_id, st.division_id) = ?";
    params.push(divisionId);
  }

  const [upcoming] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.penalty_code, p.amount, p.due_date, c.company_name as contractor_name
     ${BASE_JOINS}
     WHERE ${whereSql} AND p.recovery_status IN ('pending','partially_recovered')
       AND p.due_date IS NOT NULL AND DATEDIFF(p.due_date, CURDATE()) BETWEEN 0 AND 7
     ORDER BY p.due_date ASC LIMIT 15`,
    params
  );

  const [overdue] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.penalty_code, p.amount, p.due_date, c.company_name as contractor_name
     ${BASE_JOINS}
     WHERE ${whereSql} AND p.recovery_status IN ('pending','partially_recovered')
       AND p.due_date IS NOT NULL AND p.due_date < CURDATE()
     ORDER BY p.due_date ASC LIMIT 15`,
    params
  );

  const [recovered] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.penalty_code, p.amount, p.recovery_date, c.company_name as contractor_name
     ${BASE_JOINS}
     WHERE ${whereSql} AND p.recovery_status = 'recovered'
       AND p.recovery_date IS NOT NULL AND p.recovery_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     ORDER BY p.recovery_date DESC LIMIT 15`,
    params
  );

  return { upcoming, overdue, recovered };
};
