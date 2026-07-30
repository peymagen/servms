import { pool } from "./sql.service";
import { type Request } from "express";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "REVOKE"
  | "RECOVER"
  | "TRANSFER"
  | "ISSUE"
  | "RENEW"
  | "DOWNLOAD"
  | "PRINT"
  | "EXPORT"
  | "LOGIN"
  | "LOGOUT"
  | "PASSWORD_RESET"
  | "STATUS_CHANGE"
  | "ASSIGN"
  | "IMPORT";

interface AuditLogInput {
  req: Request;
  module: string;
  recordId?: string | number | null;
  action: AuditAction;
  oldData?: unknown;
  newData?: unknown;
  details?: string;
}

const getClientIp = (req: Request): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.socket?.remoteAddress ?? null;
};

// Writes one row to `audit_logs`. Every module's create/update/delete/approve/reject
// controller path should call this — failures are swallowed (logged to stderr only)
// so a broken audit write never blocks the underlying business operation.
export const logAudit = async ({
  req,
  module,
  recordId,
  action,
  oldData,
  newData,
  details,
}: AuditLogInput): Promise<void> => {
  const user = req.user as any;
  try {
    await pool.execute(
      `INSERT INTO audit_logs
        (user_id, role_name, action, module_name, record_id, old_data, new_data, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user?.id ?? null,
        user?.role_name ?? null,
        action,
        module,
        recordId != null ? String(recordId) : null,
        oldData != null ? JSON.stringify(oldData) : null,
        newData != null ? JSON.stringify(newData) : null,
        details ?? null,
        getClientIp(req),
        req.headers["user-agent"] ?? null,
      ]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};
