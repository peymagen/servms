import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type ITrainCreate, type ITrainUpdate } from "./train.dto";

const SELECT_COLUMNS = `t.*, d.division_name`;
const BASE_JOIN = `FROM trains t LEFT JOIN divisions d ON d.id = t.division_id`;

export const createTrain = async (data: ITrainCreate, userId: number) => {
  const query = `
    INSERT INTO trains (
      division_id, train_number, train_name, source, destination,
      opposite_train_number, opposite_train_name, opposite_source, opposite_destination, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    data.division_id,
    data.train_number,
    data.train_name,
    data.source,
    data.destination,
    data.opposite_train_number ?? null,
    data.opposite_train_name ?? null,
    data.opposite_source ?? null,
    data.opposite_destination ?? null,
    userId,
  ];
  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId, ...data };
};

export const getTrains = async (filters: {
  search?: string;
  division_id?: number;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];
  const whereClauses = ["t.status = 1"];

  if (filters.search) {
    whereClauses.push("(t.train_number LIKE ? OR t.train_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term);
  }
  if (filters.division_id) {
    whereClauses.push("t.division_id = ?");
    params.push(filters.division_id);
  }
  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total ${BASE_JOIN} ${whereSql}`, params);
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT ${SELECT_COLUMNS} ${BASE_JOIN} ${whereSql}
    ORDER BY t.train_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

export const getTrainById = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${SELECT_COLUMNS} ${BASE_JOIN} WHERE t.id = ? AND t.status = 1`, [id]);
  return rows[0] ?? null;
};

export const editTrain = async (id: string, data: ITrainUpdate) => {
  const allowedFields: Array<keyof ITrainUpdate> = [
    "division_id", "train_number", "train_name", "source", "destination",
    "opposite_train_number", "opposite_train_name", "opposite_source", "opposite_destination",
  ];
  const updates: string[] = [];
  const values: any[] = [];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }
  if (updates.length === 0) throw new Error("No fields provided to update");
  values.push(id);
  await pool.execute(`UPDATE trains SET ${updates.join(", ")} WHERE id = ?`, values);
  return getTrainById(id);
};

export const deleteTrain = async (id: string) => {
  await pool.execute("UPDATE trains SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};
