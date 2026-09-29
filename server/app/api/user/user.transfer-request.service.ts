import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { sendEmail } from "../../common/services/email.service";

// "Request should be raised to servmshqadmin@gmail.com" — same fixed address the
// password-reset request flow notifies, per the spec's exact wording covering
// both request types.
const HQ_ADMIN_NOTIFY_EMAIL = "servmshqadmin@gmail.com";

const SELECT_COLUMNS = `
  utr.*,
  u.full_name as user_name, u.employee_id,
  fd.division_name as from_division_name, td.division_name as to_division_name,
  fr.role_name as from_role_name, tr.role_name as to_role_name,
  rb.full_name as requested_by_name,
  ab.full_name as action_taken_by_name
`;

const BASE_JOINS = `
  FROM user_transfer_requests utr
  LEFT JOIN users u ON u.id = utr.user_id
  LEFT JOIN divisions fd ON fd.id = utr.from_division_id
  LEFT JOIN divisions td ON td.id = utr.to_division_id
  LEFT JOIN roles fr ON fr.id = utr.from_role_id
  LEFT JOIN roles tr ON tr.id = utr.to_role_id
  LEFT JOIN users rb ON rb.id = utr.requested_by
  LEFT JOIN users ab ON ab.id = utr.action_taken_by
`;

export const raiseTransferRequest = async (
  userId: number,
  requestedBy: number,
  data: { to_division_id?: number; to_role_id?: number; reason?: string }
) => {
  if (!data.to_division_id && !data.to_role_id) {
    throw new Error("At least one of to_division_id or to_role_id is required");
  }

  const [userRows] = await pool.execute<RowDataPacket[]>(
    "SELECT division_id, role_id FROM users WHERE id = ? AND status = 1",
    [userId]
  );
  if (!userRows[0]) throw new Error("User not found");

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO user_transfer_requests
      (user_id, from_division_id, to_division_id, from_role_id, to_role_id, reason, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      userRows[0].division_id ?? null,
      data.to_division_id ?? null,
      userRows[0].role_id ?? null,
      data.to_role_id ?? null,
      data.reason ?? null,
      requestedBy,
    ]
  );

  // Best-effort notification — a mail-server hiccup shouldn't fail the request
  // itself, since the request is already durably tracked in the DB either way
  // (same convention as the password-reset request flow).
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${SELECT_COLUMNS} ${BASE_JOINS} WHERE utr.id = ?`,
      [result.insertId]
    );
    const info = rows[0];
    await sendEmail({
      from: process.env.MAIL_USER,
      to: HQ_ADMIN_NOTIFY_EMAIL,
      subject: `User Transfer Request #${result.insertId} — ${info?.user_name ?? "Unknown user"}`,
      html: `
        <p>A user transfer request has been raised in SERVMS.</p>
        <ul>
          <li><b>Request ID:</b> ${result.insertId}</li>
          <li><b>User:</b> ${info?.user_name ?? "—"} (${info?.employee_id ?? "—"})</li>
          <li><b>Division:</b> ${info?.from_division_name ?? "—"} → ${info?.to_division_name ?? info?.from_division_name ?? "—"}</li>
          <li><b>Role:</b> ${info?.from_role_name ?? "—"} → ${info?.to_role_name ?? info?.from_role_name ?? "—"}</li>
          <li><b>Requested By:</b> ${info?.requested_by_name ?? "—"}</li>
          <li><b>Reason:</b> ${data.reason ?? "—"}</li>
        </ul>
        <p>Review and act on this request from the User Management module.</p>
      `,
    });
  } catch {
    // Swallow — logged at the transport level already by sendEmail's own catch.
  }

  return { id: result.insertId, user_id: userId };
};

export const getTransferRequests = async (approvalStatus?: string, divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "WHERE utr.status = 1";
  if (divisionId !== undefined) {
    whereSql += " AND (utr.from_division_id = ? OR utr.to_division_id = ?)";
    params.push(divisionId, divisionId);
  }
  if (approvalStatus) {
    whereSql += " AND utr.approval_status = ?";
    params.push(approvalStatus);
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${SELECT_COLUMNS} ${BASE_JOINS} ${whereSql} ORDER BY utr.created_at DESC`,
    params
  );
  return rows;
};

export const getTransferRequestById = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${SELECT_COLUMNS} ${BASE_JOINS} WHERE utr.id = ? AND utr.status = 1`,
    [id]
  );
  return rows[0] ?? null;
};

const assertPending = async (id: string): Promise<RowDataPacket> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM user_transfer_requests WHERE id = ? AND status = 1`,
    [id]
  );
  if (!rows[0]) throw new Error("Transfer request not found");
  if (rows[0].approval_status !== "pending") {
    throw new Error(`This request has already been ${rows[0].approval_status}`);
  }
  return rows[0];
};

export const approveTransferRequest = async (id: string, actionTakenBy: number, remarks?: string) => {
  const request = await assertPending(id);

  const updates: string[] = [];
  const values: any[] = [];
  if (request.to_division_id !== null) {
    updates.push("division_id = ?");
    values.push(request.to_division_id);
  }
  if (request.to_role_id !== null) {
    updates.push("role_id = ?");
    values.push(request.to_role_id);
  }
  if (updates.length > 0) {
    values.push(request.user_id);
    await pool.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
  }

  await pool.execute(
    `UPDATE user_transfer_requests
     SET approval_status = 'approved', action_taken_by = ?, action_taken_at = NOW(), remarks = ?
     WHERE id = ?`,
    [actionTakenBy, remarks ?? null, id]
  );

  return { id: Number(id), user_id: request.user_id };
};

export const rejectTransferRequest = async (id: string, actionTakenBy: number, remarks?: string) => {
  await assertPending(id);
  await pool.execute(
    `UPDATE user_transfer_requests
     SET approval_status = 'rejected', action_taken_by = ?, action_taken_at = NOW(), remarks = ?
     WHERE id = ?`,
    [actionTakenBy, remarks ?? null, id]
  );
  return { id: Number(id) };
};
