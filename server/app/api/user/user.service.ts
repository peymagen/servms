import { type IUserCreate, type IUserUpdate } from "./user.dto";
import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CARD SIGNING AUTHORITY ELIGIBILITY ─────────────────────────────────────────
// Only JS/SS-graded Admin-tier or Sub Admin-tier users (HQ or Divisional) may be
// granted Card Signing Authority — Divisional/HQ Admin included, since a division's
// signing authority is commonly its own Divisional Admin, not just its Sub Admin.
const SIGNING_ELIGIBLE_ROLES = ["hq_admin", "hq_sub_admin", "divisional_admin", "divisional_sub_admin"];

const assertCardSigningEligibility = async (
  roleId: number | undefined,
  designationGrade: string | null | undefined,
  cardSigningAuthority: boolean | undefined
) => {
  if (!cardSigningAuthority) return;
  if (!roleId) {
    throw new Error("A role is required to grant Card Signing Authority");
  }
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT role_name FROM roles WHERE id = ?", [roleId]);
  const roleName = rows[0]?.role_name;
  if (!roleName || !SIGNING_ELIGIBLE_ROLES.includes(roleName)) {
    throw new Error("Only HQ/Divisional Admin or Sub Admin roles can be granted Card Signing Authority");
  }
  if (!designationGrade || !["JS", "SS"].includes(designationGrade)) {
    throw new Error("Card Signing Authority requires a JS or SS designation grade");
  }
};

// ─── CREATE ────────────────────────────────────────────────────────────────────
export const createUser = async (data: IUserCreate) => {
  await assertCardSigningEligibility(data.role_id, data.designation_grade, data.card_signing_authority);

  const columns: string[] = ["employee_id", "username", "full_name", "password_hash", "role_id"];
  const values: any[] = [data.employee_id, data.username, data.full_name, data.password, data.role_id];

  const optionalFields: Array<[keyof IUserCreate, string]> = [
    ["hrms_id", "hrms_id"],
    ["email", "email"],
    ["mobile", "mobile"],
    ["division_id", "division_id"],
    ["zone_id", "zone_id"],
    ["station_id", "station_id"],
    ["profile_image", "profile_image"],
    ["signature_path", "signature_path"],
    ["users_status", "users_status"],
    ["designation", "designation"],
    ["designation_grade", "designation_grade"],
  ];
  for (const [key, column] of optionalFields) {
    if (data[key] !== undefined && data[key] !== null) {
      columns.push(column);
      values.push(data[key]);
    }
  }
  if (data.card_signing_authority !== undefined) {
    columns.push("card_signing_authority");
    values.push(data.card_signing_authority ? 1 : 0);
  }

  const placeholders = columns.map(() => "?").join(", ");
  const query = `INSERT INTO users (${columns.join(", ")}) VALUES (${placeholders})`;

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { insertId: result.insertId };
};

// ─── FULL UPDATE (PUT) ─────────────────────────────────────────────────────────
export const updateUser = async (id: string, data: IUserCreate) => {
  await assertCardSigningEligibility(data.role_id, data.designation_grade, data.card_signing_authority);

  const query = `
    UPDATE users
    SET employee_id = ?, hrms_id = ?, username = ?, full_name = ?, role_id = ?, division_id = ?, zone_id = ?, station_id = ?,
        email = ?, mobile = ?, users_status = ?, designation = ?, designation_grade = ?, card_signing_authority = ?
    WHERE id = ?
  `;
  const values = [
    data.employee_id,
    data.hrms_id ?? null,
    data.username,
    data.full_name,
    data.role_id,
    data.division_id ?? null,
    data.zone_id ?? null,
    data.station_id ?? null,
    data.email ?? null,
    data.mobile ?? null,
    data.users_status ?? "active",
    data.designation ?? null,
    data.designation_grade ?? null,
    data.card_signing_authority ? 1 : 0,
    id
  ];
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── PARTIAL UPDATE (PATCH) ────────────────────────────────────────────────────
export const editUser = async (id: string, data: IUserUpdate) => {
  if (data.card_signing_authority !== undefined) {
    const roleId = data.role_id ?? (await getUserById(id) as any)?.role_id;
    const designationGrade = data.designation_grade !== undefined
      ? data.designation_grade
      : (await getUserById(id) as any)?.designation_grade;
    await assertCardSigningEligibility(roleId, designationGrade, data.card_signing_authority);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if ((data as any).password_hash) {
    updates.push("password_hash = ?");
    values.push((data as any).password_hash);
    updates.push("is_temp_password = ?");
    values.push((data as any).is_temp_password ? 1 : 0);
  }
  const directFields: Array<[keyof IUserUpdate, string]> = [
    ["employee_id", "employee_id"],
    ["hrms_id", "hrms_id"],
    ["username", "username"],
    ["full_name", "full_name"],
    ["designation", "designation"],
    ["designation_grade", "designation_grade"],
    ["role_id", "role_id"],
    ["division_id", "division_id"],
    ["zone_id", "zone_id"],
    ["station_id", "station_id"],
    ["email", "email"],
    ["mobile", "mobile"],
    ["profile_image", "profile_image"],
    ["signature_path", "signature_path"],
    ["users_status", "users_status"],
  ];
  for (const [key, column] of directFields) {
    if (data[key] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(data[key]);
    }
  }
  if (data.card_signing_authority !== undefined) {
    updates.push("card_signing_authority = ?");
    values.push(data.card_signing_authority ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error("No fields provided to update");
  }

  values.push(id);
  const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── DELETE ────────────────────────────────────────────────────────────────────
export const deleteUser = async (id: string) => {
  const query = "DELETE FROM users WHERE id = ?";
  await pool.execute(query, [id]);
  return { id, deleted: true };
};

const USER_SELECT_COLUMNS = `
      u.id, u.employee_id, u.hrms_id, u.username, u.full_name, u.designation, u.designation_grade,
      u.card_signing_authority, u.email, u.mobile, u.is_temp_password, u.users_status, u.last_login_at, u.created_at,
      u.role_id, u.division_id, u.zone_id, u.station_id, u.profile_image, u.signature_path,
      r.role_name,
      d.division_name,
      z.zone_name,
      s.station_name`;

// ─── GET BY ID ─────────────────────────────────────────────────────────────────
export const getUserById = async (id: string) => {
  const query = `
    SELECT${USER_SELECT_COLUMNS}
    FROM users u
    LEFT JOIN roles     r ON r.id = u.role_id
    LEFT JOIN divisions d ON d.id = u.division_id
    LEFT JOIN zones     z ON z.id = u.zone_id
    LEFT JOIN stations  s ON s.id = u.station_id
    WHERE u.id = ?
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── GET ALL ───────────────────────────────────────────────────────────────────
export const getAllUsers = async (divisionId?: number) => {
  const params: any[] = [];
  const whereSql = divisionId ? "WHERE u.division_id = ?" : "";
  if (divisionId) params.push(divisionId);

  const query = `
    SELECT${USER_SELECT_COLUMNS}
    FROM users u
    LEFT JOIN roles     r ON r.id = u.role_id
    LEFT JOIN divisions d ON d.id = u.division_id
    LEFT JOIN zones     z ON z.id = u.zone_id
    LEFT JOIN stations  s ON s.id = u.station_id
    ${whereSql}
    ORDER BY u.created_at DESC
  `;
  const [rows] = await pool.execute(query, params);
  return rows;
};

// ─── GET BY USERNAME (used by Passport login) ──────────────────────────────────
export const getUserByUsername = async (username: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.*, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.username = ?`,
    [username]
  );
  return rows.length > 0 ? rows[0] : null;
};

// ─── GET BY EMAIL (optional helper) ───────────────────────────────────────
export const getUserByEmail = async (email: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.*, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
};

// ─── UPDATE LAST LOGIN ─────────────────────────────────────────────────────────
export const updateLastLogin = async (id: string) => {
  await pool.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [id]);
};

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────────
// Clears is_temp_password — a self-service password change always ends the
// "must change temporary password" state, regardless of how it was set.
export const changePassword = async (id: string, newPasswordHash: string) => {
  await pool.execute("UPDATE users SET password_hash = ?, is_temp_password = 0 WHERE id = ?", [newPasswordHash, id]);
  return { id, passwordChanged: true };
};

// ─── TOGGLE STATUS ─────────────────────────────────────────────────────────────
export const toggleStatus = async (id: string) => {
  const user = await getUserById(id);
  if (!user) throw new Error("User not found");
  const newStatus = (user as any).users_status === "active" ? "inactive" : "active";
  await pool.execute("UPDATE users SET users_status = ? WHERE id = ?", [newStatus, id]);
  return { id, users_status: newStatus };
};

// ─── APPROVE / REJECT (dedicated gated actions, separate from generic edit) ────
// A sub-admin-created user sits in `pending_approval` until an Admin (the only
// role with user_management.approve_reject) moves them out of it — this used to
// only be reachable via a generic PATCH /:id gated on can_edit, which sub-admins
// also hold, letting them silently self-approve.
export const approveUser = async (id: string) => {
  const user = await getUserById(id);
  if (!user) throw new Error("User not found");
  const previousStatus = (user as any).users_status;
  if (previousStatus !== "pending_approval") {
    throw new Error("Only users pending approval can be approved");
  }
  await pool.execute("UPDATE users SET users_status = 'active' WHERE id = ?", [id]);
  return { id: Number(id), previousStatus, newStatus: "active" };
};

export const rejectUser = async (id: string, reason?: string) => {
  const user = await getUserById(id);
  if (!user) throw new Error("User not found");
  const previousStatus = (user as any).users_status;
  if (previousStatus !== "pending_approval") {
    throw new Error("Only users pending approval can be rejected");
  }
  // Rejected users are deactivated rather than deleted, preserving the create
  // record and audit trail — mirrors the soft-delete convention used elsewhere.
  await pool.execute("UPDATE users SET users_status = 'inactive' WHERE id = ?", [id]);
  return { id: Number(id), previousStatus, newStatus: "inactive", reason };
};