import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { MODULE_NAMES } from "./role.dto";

// ─── GET ROLES (WITH USER COUNT) ────────────────────────────────────────────────
export const getRoles = async () => {
  const query = `
    SELECT
      r.*,
      (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
    FROM roles r
    WHERE r.status = 1
    ORDER BY r.created_at ASC
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query);
  return rows;
};

// ─── GET ROLE BY ID ──────────────────────────────────────────────────────────────
export const getRoleById = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM roles WHERE id = ? AND status = 1",
    [id]
  );
  return rows[0] ?? null;
};

// ─── CREATE ROLE (SEEDS DEFAULT PERMISSION ROWS) ────────────────────────────────
export const createRole = async (data: { role_name: string; description?: string }) => {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO roles (role_name, description) VALUES (?, ?)",
    [data.role_name, data.description ?? null]
  );
  const roleId = result.insertId;

  for (const mod of MODULE_NAMES) {
    await pool.execute(
      `INSERT INTO role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export)
       VALUES (?, ?, 0, 0, 0, 0, 0, 0)`,
      [roleId, mod]
    );
  }

  return { id: roleId, role_name: data.role_name };
};

// ─── EDIT ROLE (PATCH) ───────────────────────────────────────────────────────────
export const editRole = async (id: string, data: any) => {
  const allowedFields = ["role_name", "description", "roles_status"];
  const updates: string[] = [];
  const values: any[] = [];

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
  await pool.execute(`UPDATE roles SET ${updates.join(", ")} WHERE id = ?`, values);
  return { ...data, id };
};

// ─── DELETE ROLE ──────────────────────────────────────────────────────────────────
export const deleteRole = async (id: string) => {
  await pool.execute("UPDATE roles SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};

// ─── GET PERMISSION MATRIX FOR A ROLE ───────────────────────────────────────────
export const getRolePermissions = async (roleId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM role_permissions WHERE role_id = ? AND status = 1",
    [roleId]
  );
  return rows;
};

// ─── BULK UPDATE PERMISSION MATRIX FOR A ROLE ───────────────────────────────────
export const updateRolePermissions = async (
  roleId: string,
  permissions: Array<{
    module_name: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_approve_reject: boolean;
    can_export: boolean;
  }>
) => {
  for (const perm of permissions) {
    await pool.execute(
      `INSERT INTO role_permissions
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        can_view = VALUES(can_view),
        can_create = VALUES(can_create),
        can_edit = VALUES(can_edit),
        can_delete = VALUES(can_delete),
        can_approve_reject = VALUES(can_approve_reject),
        can_export = VALUES(can_export)`,
      [
        roleId,
        perm.module_name,
        perm.can_view ? 1 : 0,
        perm.can_create ? 1 : 0,
        perm.can_edit ? 1 : 0,
        perm.can_delete ? 1 : 0,
        perm.can_approve_reject ? 1 : 0,
        perm.can_export ? 1 : 0,
      ]
    );
  }

  return getRolePermissions(roleId);
};
