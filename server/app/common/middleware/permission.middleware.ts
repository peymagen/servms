import expressAsyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { pool } from "../services/sql.service";
import { type RowDataPacket } from "mysql2";
import { type ModuleName } from "../../api/role/role.dto";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve_reject" | "export";

const ACTION_COLUMN: Record<PermissionAction, string> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  approve_reject: "can_approve_reject",
  export: "can_export",
};

// Super Admin HQ has complete control over every zone and division, so it always
// bypasses the permission matrix rather than depending on seeded rows staying in sync.
const SUPER_ADMIN_ROLE = "super_admin_hq";

// Gate a route on the role_permissions matrix for (req.user.role_id, module, action).
// A missing row is treated as an implicit deny — every role/module pair should be
// seeded (see seed.ts / migrations/001), so a missing row usually means a new module
// was added without a corresponding permission row.
export const requirePermission = (module: ModuleName, action: PermissionAction) =>
  expressAsyncHandler(async (req, res, next) => {
    const user = req.user as any;
    if (!user) {
      throw createHttpError(401, "Not authenticated");
    }
    if (user.role_name === SUPER_ADMIN_ROLE) {
      next();
      return;
    }

    const column = ACTION_COLUMN[action];
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${column} AS allowed FROM role_permissions WHERE role_id = ? AND module_name = ? AND status = 1`,
      [user.role_id, module]
    );

    if (!rows.length || !rows[0]!.allowed) {
      throw createHttpError(403, `You do not have permission to ${action} ${module}`);
    }
    next();
  });

// Gate a route on an explicit list of role_name values, bypassing the
// role_permissions matrix entirely. Use this only when a requirement names
// specific roles verbatim (e.g. "Only HQ Admin, Divisional Admin, Sub Admin
// can manage Complaint Type/Sub-type") rather than expressing a generic
// module × action permission — Super Admin HQ still always passes.
export const requireAnyRole = (roleNames: string[]) =>
  expressAsyncHandler(async (req, res, next) => {
    const user = req.user as any;
    if (!user) {
      throw createHttpError(401, "Not authenticated");
    }
    if (user.role_name === SUPER_ADMIN_ROLE || roleNames.includes(user.role_name)) {
      next();
      return;
    }
    throw createHttpError(403, "You do not have permission to perform this action");
  });
