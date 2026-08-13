import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type IDropdownOptionCreate, type IDropdownOptionUpdate } from "./dropdown.dto";

// Options visible for a category are the global ones (division_id IS NULL) plus any
// scoped specifically to the given division — global options apply everywhere.
// When parentId is passed, results are further restricted to children of that
// parent option (e.g. Complaint Sub-type options for a chosen Complaint Type).
export const getDropdownOptions = async (category: string, divisionId?: number, parentId?: number, includeInactive = false) => {
  const params: any[] = [category];
  let whereSql = `category = ? ${includeInactive ? "" : "AND status = 1"} AND (division_id IS NULL`;
  if (divisionId) {
    whereSql += " OR division_id = ?)";
    params.push(divisionId);
  } else {
    whereSql += ")";
  }

  if (parentId !== undefined) {
    whereSql += " AND parent_id = ?";
    params.push(parentId);
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM dropdown_options WHERE ${whereSql} ORDER BY sort_order ASC, label ASC`,
    params
  );
  return rows;
};

export const getCategories = async () => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT DISTINCT category FROM dropdown_options WHERE status = 1 ORDER BY category ASC"
  );
  return rows.map((r) => r.category);
};

export const createDropdownOption = async (data: IDropdownOptionCreate, userId: number) => {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO dropdown_options (category, parent_id, division_id, value, label, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.category, data.parent_id ?? null, data.division_id ?? null, data.value, data.label, data.sort_order ?? 0, userId]
  );
  return { id: result.insertId, ...data };
};

export const editDropdownOption = async (id: string, data: IDropdownOptionUpdate) => {
  const updates: string[] = [];
  const values: any[] = [];
  if (data.label !== undefined) {
    updates.push("label = ?");
    values.push(data.label);
  }
  if (data.sort_order !== undefined) {
    updates.push("sort_order = ?");
    values.push(data.sort_order);
  }
  if (updates.length === 0) throw new Error("No fields provided to update");
  values.push(id);
  await pool.execute(`UPDATE dropdown_options SET ${updates.join(", ")} WHERE id = ?`, values);
  return { ...data, id };
};

export const deleteDropdownOption = async (id: string) => {
  await pool.execute("UPDATE dropdown_options SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};

export const activateDropdownOption = async (id: string) => {
  await pool.execute("UPDATE dropdown_options SET status = 1 WHERE id = ?", [id]);
  return { id, activated: true };
};
