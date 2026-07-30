import mysql, { type PoolConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
console.log(process.env.DB_HOST);

// Create a pool to the MySQL database
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  database: process.env.DB_DATABASE,   // ← fixed typo: DARABASE → DATABASE
  waitForConnections: true,
});

// Runs `fn` inside a dedicated connection with a transaction — commits on success,
// rolls back on any thrown error. Use for any operation that issues more than one
// write that must succeed or fail together (e.g. a row insert plus dependent rows).
export const withTransaction = async <T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};