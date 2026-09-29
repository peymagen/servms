import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { recordStatusChange } from "./complaint.service";

const assertComplaintExists = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, complaints_status FROM complaints WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows.length) throw new Error("Complaint not found");
  return rows[0]!;
};

const assertAtrExists = async (atrId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM complaint_action_taken_reports WHERE id = ? AND status = 1",
    [atrId]
  );
  if (!rows.length) throw new Error("Action Taken Report not found");
  return rows[0]!;
};

// Rejects an ATR id that isn't one of the complaint's own ATRs (routes carry both).
export const assertAtrBelongsTo = async (atrId: string, complaintId: string) => {
  const atr = await assertAtrExists(atrId);
  if (Number(atr.complaint_id) !== Number(complaintId)) throw new Error("Action Taken Report not found");
};

// ─── DEALING SECTION: submit a new ATR ─────────────────────────────────────────
export const submitAtr = async (complaintId: string, remarks: string, userId: number) => {
  const complaint = await assertComplaintExists(complaintId);
  if (!["assigned", "under_review", "action_taken"].includes(complaint.complaints_status)) {
    throw new Error(`Cannot submit an Action Taken Report while the complaint is "${complaint.complaints_status}"`);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO complaint_action_taken_reports (complaint_id, remarks, submitted_by, submitted_at, review_status)
     VALUES (?, ?, ?, NOW(), 'pending_review')`,
    [complaintId, remarks, userId]
  );

  if (complaint.complaints_status !== "action_taken") {
    await pool.execute(`UPDATE complaints SET complaints_status = 'action_taken' WHERE id = ?`, [complaintId]);
    await recordStatusChange(Number(complaintId), complaint.complaints_status, "action_taken", userId, "Action Taken Report submitted");
  }

  return { id: result.insertId, complaint_id: Number(complaintId) };
};

// ─── DEALING SECTION: edit an ATR while it is still pending review ─────────────
export const editAtr = async (atrId: string, remarks: string, userId: number) => {
  const atr = await assertAtrExists(atrId);
  if (atr.review_status !== "pending_review") {
    throw new Error(`Cannot edit an Action Taken Report once it is "${atr.review_status}"`);
  }
  if (atr.submitted_by !== userId) {
    throw new Error("Only the submitter can edit this Action Taken Report");
  }
  await pool.execute(`UPDATE complaint_action_taken_reports SET remarks = ? WHERE id = ?`, [remarks, atrId]);
  return { id: Number(atrId), remarks };
};

// ─── SUB-ADMIN: review an ATR and forward it to Admin ──────────────────────────
export const reviewAtr = async (complaintId: string, atrId: string, remarks: string | undefined, userId: number) => {
  const atr = await assertAtrExists(atrId);
  if (atr.review_status !== "pending_review") {
    throw new Error(`Cannot review an Action Taken Report that is already "${atr.review_status}"`);
  }

  await pool.execute(
    `UPDATE complaint_action_taken_reports SET review_status = 'sub_admin_reviewed', reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?`,
    [userId, remarks ?? null, atrId]
  );

  const complaint = await assertComplaintExists(complaintId);
  if (complaint.complaints_status !== "under_review") {
    await pool.execute(`UPDATE complaints SET complaints_status = 'under_review' WHERE id = ?`, [complaintId]);
    await recordStatusChange(Number(complaintId), complaint.complaints_status, "under_review", userId, "Action Taken Report reviewed by Sub-admin");
  }

  return { id: Number(atrId) };
};

// ─── ADMIN: accept / reject / send back ────────────────────────────────────────
export const decideAtr = async (
  complaintId: string,
  atrId: string,
  decision: "accepted" | "rejected" | "sent_back",
  remarks: string | undefined,
  userId: number
) => {
  const atr = await assertAtrExists(atrId);
  if (atr.review_status !== "sub_admin_reviewed") {
    throw new Error(`Cannot decide an Action Taken Report before Sub-admin review (currently "${atr.review_status}")`);
  }

  await pool.execute(
    `UPDATE complaint_action_taken_reports SET review_status = ?, decided_by = ?, decided_at = NOW(), decision_remarks = ? WHERE id = ?`,
    [decision, userId, remarks ?? null, atrId]
  );

  const complaint = await assertComplaintExists(complaintId);
  const nextStatus = decision === "accepted" ? "approved" : decision === "rejected" ? "rejected" : "assigned";

  await pool.execute(`UPDATE complaints SET complaints_status = ? WHERE id = ?`, [nextStatus, complaintId]);
  await recordStatusChange(
    Number(complaintId),
    complaint.complaints_status,
    nextStatus,
    userId,
    decision === "sent_back" ? `Sent back to Dealing Section: ${remarks ?? ""}`.trim() : remarks
  );

  return { id: Number(atrId), complaints_status: nextStatus };
};

// ─── ADMIN: close a complaint once approved or rejected ────────────────────────
export const closeComplaint = async (complaintId: string, userId: number, remarks?: string) => {
  const complaint = await assertComplaintExists(complaintId);
  if (!["approved", "rejected"].includes(complaint.complaints_status)) {
    throw new Error(`Cannot close a complaint that is "${complaint.complaints_status}"`);
  }
  await pool.execute(`UPDATE complaints SET complaints_status = 'closed', closed_by = ?, closed_at = NOW() WHERE id = ?`, [
    userId,
    complaintId,
  ]);
  await recordStatusChange(Number(complaintId), complaint.complaints_status, "closed", userId, remarks);
  return { id: Number(complaintId), complaints_status: "closed" };
};

export const getAtrsForComplaint = async (complaintId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT atr.*, sb.full_name as submitted_by_name, rb.full_name as reviewed_by_name, db.full_name as decided_by_name
     FROM complaint_action_taken_reports atr
     LEFT JOIN users sb ON sb.id = atr.submitted_by
     LEFT JOIN users rb ON rb.id = atr.reviewed_by
     LEFT JOIN users db ON db.id = atr.decided_by
     WHERE atr.complaint_id = ? AND atr.status = 1 ORDER BY atr.created_at DESC`,
    [complaintId]
  );
  return rows;
};
