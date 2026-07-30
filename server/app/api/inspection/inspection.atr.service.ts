import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { recordStatusChange } from "./inspection.service";

export interface IAtrDraftInput {
  action_description: string;
  action_date?: string;
  completion_status?: "in_progress" | "partially_completed" | "completed";
  remarks?: string;
}

const assertInspectionExists = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, inspection_status FROM inspections WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows.length) throw new Error("Inspection not found");
  return rows[0]!;
};

const assertAtrExists = async (atrId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM inspection_action_taken_reports WHERE id = ? AND status = 1",
    [atrId]
  );
  if (!rows.length) throw new Error("Action Taken Report not found");
  return rows[0]!;
};

// ─── DEALING SECTION: create a new ATR draft ───────────────────────────────────
export const createAtrDraft = async (inspectionId: string, data: IAtrDraftInput, userId: number) => {
  const inspection = await assertInspectionExists(inspectionId);
  if (!["assigned", "atr_submitted"].includes(inspection.inspection_status)) {
    throw new Error(`Cannot start an Action Taken Report while the inspection is "${inspection.inspection_status}"`);
  }
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO inspection_action_taken_reports (inspection_id, action_description, action_date, completion_status, remarks, review_status)
     VALUES (?, ?, ?, ?, ?, 'draft')`,
    [inspectionId, data.action_description, data.action_date ?? null, data.completion_status ?? "in_progress", data.remarks ?? null]
  );
  return { id: result.insertId, inspection_id: Number(inspectionId) };
};

// ─── DEALING SECTION: edit ATR while Draft or Sent Back ────────────────────────
export const editAtr = async (atrId: string, data: IAtrDraftInput) => {
  const atr = await assertAtrExists(atrId);
  if (!["draft", "sent_back"].includes(atr.review_status)) {
    throw new Error(`Cannot edit an Action Taken Report once it is "${atr.review_status}"`);
  }
  await pool.execute(
    `UPDATE inspection_action_taken_reports
     SET action_description = ?, action_date = ?, completion_status = ?, remarks = ?
     WHERE id = ?`,
    [data.action_description, data.action_date ?? null, data.completion_status ?? "in_progress", data.remarks ?? null, atrId]
  );
  return { id: Number(atrId) };
};

// ─── DEALING SECTION: submit a draft ATR for Sub-admin review ──────────────────
export const submitAtr = async (inspectionId: string, atrId: string, userId: number) => {
  const atr = await assertAtrExists(atrId);
  if (!["draft", "sent_back"].includes(atr.review_status)) {
    throw new Error(`Cannot submit an Action Taken Report that is already "${atr.review_status}"`);
  }

  await pool.execute(
    `UPDATE inspection_action_taken_reports SET review_status = 'pending_review', submitted_by = ?, submitted_at = NOW() WHERE id = ?`,
    [userId, atrId]
  );

  const inspection = await assertInspectionExists(inspectionId);
  await pool.execute(`UPDATE inspections SET inspection_status = 'atr_submitted' WHERE id = ?`, [inspectionId]);
  await recordStatusChange(Number(inspectionId), inspection.inspection_status, "atr_submitted", userId, "Action Taken Report submitted");

  return { id: Number(atrId), inspection_id: Number(inspectionId) };
};

// ─── SUB-ADMIN: review ATR — forward to Admin, or send back to Dealing Section ─
export const reviewAtr = async (
  inspectionId: string,
  atrId: string,
  decision: "forward" | "send_back",
  remarks: string | undefined,
  userId: number
) => {
  const atr = await assertAtrExists(atrId);
  if (atr.review_status !== "pending_review") {
    throw new Error(`Cannot review an Action Taken Report that is already "${atr.review_status}"`);
  }

  const nextAtrStatus = decision === "forward" ? "sub_admin_reviewed" : "sent_back";
  await pool.execute(
    `UPDATE inspection_action_taken_reports SET review_status = ?, reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? WHERE id = ?`,
    [nextAtrStatus, userId, remarks ?? null, atrId]
  );

  const inspection = await assertInspectionExists(inspectionId);
  const nextInspectionStatus = decision === "forward" ? "under_review" : "assigned";
  await pool.execute(`UPDATE inspections SET inspection_status = ? WHERE id = ?`, [nextInspectionStatus, inspectionId]);
  await recordStatusChange(
    Number(inspectionId),
    inspection.inspection_status,
    nextInspectionStatus,
    userId,
    decision === "forward" ? "Forwarded to Admin" : `Sent back to Dealing Section: ${remarks ?? ""}`.trim()
  );

  return { id: Number(atrId) };
};

// ─── ADMIN: accept / reject / send back ────────────────────────────────────────
export const decideAtr = async (
  inspectionId: string,
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
    `UPDATE inspection_action_taken_reports SET review_status = ?, decided_by = ?, decided_at = NOW(), decision_remarks = ? WHERE id = ?`,
    [decision, userId, remarks ?? null, atrId]
  );

  const inspection = await assertInspectionExists(inspectionId);
  const nextStatus = decision === "accepted" ? "approved" : decision === "rejected" ? "rejected" : "assigned";

  await pool.execute(`UPDATE inspections SET inspection_status = ? WHERE id = ?`, [nextStatus, inspectionId]);
  await recordStatusChange(
    Number(inspectionId),
    inspection.inspection_status,
    nextStatus,
    userId,
    decision === "sent_back" ? `Returned to Dealing Section: ${remarks ?? ""}`.trim() : remarks
  );

  return { id: Number(atrId), inspection_status: nextStatus };
};

// ─── ADMIN: close an inspection once Approved or Rejected ──────────────────────
export const closeInspection = async (inspectionId: string, userId: number, remarks?: string) => {
  const inspection = await assertInspectionExists(inspectionId);
  if (!["approved", "rejected"].includes(inspection.inspection_status)) {
    throw new Error(`Cannot close an inspection that is "${inspection.inspection_status}"`);
  }
  await pool.execute(`UPDATE inspections SET inspection_status = 'closed', closed_by = ?, closed_at = NOW() WHERE id = ?`, [
    userId,
    inspectionId,
  ]);
  await recordStatusChange(Number(inspectionId), inspection.inspection_status, "closed", userId, remarks);
  return { id: Number(inspectionId), inspection_status: "closed" };
};

export const getAtrsForInspection = async (inspectionId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT atr.*, sb.full_name as submitted_by_name, rb.full_name as reviewed_by_name, db.full_name as decided_by_name
     FROM inspection_action_taken_reports atr
     LEFT JOIN users sb ON sb.id = atr.submitted_by
     LEFT JOIN users rb ON rb.id = atr.reviewed_by
     LEFT JOIN users db ON db.id = atr.decided_by
     WHERE atr.inspection_id = ? AND atr.status = 1 ORDER BY atr.created_at DESC`,
    [inspectionId]
  );
  return rows;
};
