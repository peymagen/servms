import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../../common/services/email.service";

// "Request should be raised to servmshqadmin@gmail.com" — a fixed address per the
// spec, not something a caller can override.
const HQ_ADMIN_NOTIFY_EMAIL = "servmshqadmin@gmail.com";

const SELECT_COLUMNS = `
  prr.*,
  ru.full_name as requested_user_name, ru.employee_id as requested_user_employee_id,
  rb.full_name as requested_by_name,
  ab.full_name as action_taken_by_name
`;

const BASE_JOINS = `
  FROM password_reset_requests prr
  LEFT JOIN users ru ON ru.id = prr.requested_user_id
  LEFT JOIN users rb ON rb.id = prr.requested_by
  LEFT JOIN users ab ON ab.id = prr.action_taken_by
`;

export const raisePasswordResetRequest = async (
  requestedUserId: number,
  requestedBy: number,
  reason: string | undefined
) => {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO password_reset_requests (requested_user_id, requested_by, reason) VALUES (?, ?, ?)`,
    [requestedUserId, requestedBy, reason ?? null]
  );

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ru.full_name as requested_user_name, ru.employee_id, rb.full_name as requested_by_name
     FROM users ru, users rb WHERE ru.id = ? AND rb.id = ?`,
    [requestedUserId, requestedBy]
  );
  const info = rows[0];

  // Best-effort notification — a mail-server hiccup shouldn't fail the request
  // itself, since the request is already durably tracked in the DB either way.
  try {
    await sendEmail({
      from: process.env.MAIL_USER,
      to: HQ_ADMIN_NOTIFY_EMAIL,
      subject: `Password Reset Request #${result.insertId} — ${info?.requested_user_name ?? "Unknown user"}`,
      html: `
        <p>A password reset request has been raised in SERVMS.</p>
        <ul>
          <li><b>Request ID:</b> ${result.insertId}</li>
          <li><b>Requested User:</b> ${info?.requested_user_name ?? "—"} (${info?.employee_id ?? "—"})</li>
          <li><b>Requested By:</b> ${info?.requested_by_name ?? "—"}</li>
          <li><b>Reason:</b> ${reason ?? "—"}</li>
        </ul>
        <p>Review and act on this request from the User Management module.</p>
      `,
    });
  } catch {
    // Swallow — logged at the transport level already by sendEmail's own catch.
  }

  return { id: result.insertId, requested_user_id: requestedUserId };
};

export const getPasswordResetRequests = async (approvalStatus?: string) => {
  const params: any[] = [];
  let whereSql = "WHERE prr.status = 1";
  if (approvalStatus) {
    whereSql += " AND prr.approval_status = ?";
    params.push(approvalStatus);
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${SELECT_COLUMNS} ${BASE_JOINS} ${whereSql} ORDER BY prr.created_at DESC`,
    params
  );
  return rows;
};

const assertPending = async (id: string): Promise<RowDataPacket> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM password_reset_requests WHERE id = ? AND status = 1`,
    [id]
  );
  if (!rows[0]) throw new Error("Password reset request not found");
  if (rows[0].approval_status !== "pending") {
    throw new Error(`This request has already been ${rows[0].approval_status}`);
  }
  return rows[0];
};

// Generates a fresh temporary password, hashes it onto the target user's account
// (is_temp_password=1, forcing a change on next login — same convention as
// Admin-set temp passwords elsewhere in user.service.ts), and records the
// decision. The plaintext temp password is returned ONCE so the approving
// admin can relay it to the user out-of-band — it is never stored or emailed.
export const approvePasswordResetRequest = async (id: string, actionTakenBy: number, remarks?: string) => {
  const request = await assertPending(id);

  const tempPassword = crypto.randomBytes(6).toString("base64url"); // ~8 url-safe chars
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await pool.execute("UPDATE users SET password_hash = ?, is_temp_password = 1 WHERE id = ?", [
    passwordHash,
    request.requested_user_id,
  ]);

  await pool.execute(
    `UPDATE password_reset_requests
     SET approval_status = 'approved', action_taken_by = ?, action_taken_at = NOW(), remarks = ?
     WHERE id = ?`,
    [actionTakenBy, remarks ?? null, id]
  );

  return { id: Number(id), requested_user_id: request.requested_user_id, temp_password: tempPassword };
};

export const rejectPasswordResetRequest = async (id: string, actionTakenBy: number, remarks?: string) => {
  await assertPending(id);
  await pool.execute(
    `UPDATE password_reset_requests
     SET approval_status = 'rejected', action_taken_by = ?, action_taken_at = NOW(), remarks = ?
     WHERE id = ?`,
    [actionTakenBy, remarks ?? null, id]
  );
  return { id: Number(id) };
};
