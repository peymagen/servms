import { type IUserCreate, type IUserUpdate } from "./user.dto";
import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CREATE ────────────────────────────────────────────────────────────────────
export const createUser = async (data: IUserCreate) => {
  const columns: string[] = ["employee_id", "username", "full_name", "password_hash", "role_id"];
  const values: any[] = [data.employee_id, data.username, data.full_name, data.password, data.role_id];

  if (data.email !== undefined && data.email !== null) {
    columns.push("email");
    values.push(data.email);
  }
  if (data.mobile !== undefined && data.mobile !== null) {
    columns.push("mobile");
    values.push(data.mobile);
  }
  if (data.division_id !== undefined && data.division_id !== null) {
    columns.push("division_id");
    values.push(data.division_id);
  }
  if (data.station_id !== undefined && data.station_id !== null) {
    columns.push("station_id");
    values.push(data.station_id);
  }
  if (data.profile_image !== undefined && data.profile_image !== null) {
    columns.push("profile_image");
    values.push(data.profile_image);
  }
  if (data.users_status !== undefined && data.users_status !== null) {
    columns.push("users_status");
    values.push(data.users_status);
  }
  if (data.designation !== undefined && data.designation !== null) {
    columns.push("designation");
    values.push(data.designation);
  }

  const placeholders = columns.map(() => "?").join(", ");
  const query = `INSERT INTO users (${columns.join(", ")}) VALUES (${placeholders})`;

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { insertId: result.insertId };
};

// ─── FULL UPDATE (PUT) ─────────────────────────────────────────────────────────
export const updateUser = async (id: string, data: IUserCreate) => {
  const query = `
    UPDATE users
    SET employee_id = ?, username = ?, full_name = ?, role_id = ?, division_id = ?, station_id = ?, email = ?, mobile = ?, users_status = ?, designation = ?
    WHERE id = ?
  `;
  const values = [
    data.employee_id,
    data.username,
    data.full_name,
    data.role_id,
    data.division_id ?? null,
    data.station_id ?? null,
    data.email ?? null,
    data.mobile ?? null,
    data.users_status ?? "active",
    data.designation ?? null,
    id
  ];
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── PARTIAL UPDATE (PATCH) ────────────────────────────────────────────────────
export const editUser = async (id: string, data: IUserUpdate) => {
  const updates: string[] = [];
  const values: any[] = [];

  if ((data as any).password_hash) {
    updates.push("password_hash = ?");
    values.push((data as any).password_hash);
  }
  if (data.employee_id !== undefined) {
    updates.push("employee_id = ?");
    values.push(data.employee_id);
  }
  if (data.username !== undefined) {
    updates.push("username = ?");
    values.push(data.username);
  }
  if (data.full_name !== undefined) {
    updates.push("full_name = ?");
    values.push(data.full_name);
  }
  if (data.designation !== undefined) {
    updates.push("designation = ?");
    values.push(data.designation);
  }
  if (data.role_id !== undefined) {
    updates.push("role_id = ?");
    values.push(data.role_id);
  }
  if (data.division_id !== undefined) {
    updates.push("division_id = ?");
    values.push(data.division_id);
  }
  if (data.station_id !== undefined) {
    updates.push("station_id = ?");
    values.push(data.station_id);
  }
  if (data.email !== undefined) {
    updates.push("email = ?");
    values.push(data.email);
  }
  if (data.mobile !== undefined) {
    updates.push("mobile = ?");
    values.push(data.mobile);
  }
  if (data.profile_image !== undefined) {
    updates.push("profile_image = ?");
    values.push(data.profile_image);
  }
  if (data.users_status !== undefined) {
    updates.push("users_status = ?");
    values.push(data.users_status);
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

// ─── GET BY ID ─────────────────────────────────────────────────────────────────
export const getUserById = async (id: string) => {
  const query = `
    SELECT
      u.id, u.employee_id, u.username, u.full_name, u.designation, u.email, u.mobile, u.users_status, u.last_login_at, u.created_at,
      u.role_id, u.division_id, u.station_id,
      r.role_name,
      d.division_name,
      s.station_name
    FROM users u
    LEFT JOIN roles     r ON r.id = u.role_id
    LEFT JOIN divisions d ON d.id = u.division_id
    LEFT JOIN stations  s ON s.id = u.station_id
    WHERE u.id = ?
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── GET ALL ───────────────────────────────────────────────────────────────────
export const getAllUsers = async () => {
  const query = `
    SELECT
      u.id, u.employee_id, u.username, u.full_name, u.designation, u.email, u.mobile, u.users_status, u.last_login_at, u.created_at,
      u.role_id, u.division_id, u.station_id,
      r.role_name,
      d.division_name,
      s.station_name
    FROM users u
    LEFT JOIN roles     r ON r.id = u.role_id
    LEFT JOIN divisions d ON d.id = u.division_id
    LEFT JOIN stations  s ON s.id = u.station_id
    ORDER BY u.created_at DESC
  `;
  const [rows] = await pool.execute(query);
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
export const changePassword = async (id: string, newPasswordHash: string) => {
  await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [newPasswordHash, id]);
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