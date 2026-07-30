import { pool, withTransaction } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader, type PoolConnection } from "mysql2/promise";
import { type IClusterCreate, type IClusterUpdate } from "./cluster.dto";

// Members of a cluster must all belong to the cluster's own division and match its
// type (station-cluster → stations only, train-cluster → trains only) — per UAT.
const assertMembersValid = async (
  conn: PoolConnection,
  divisionId: number,
  clusterType: "station" | "train",
  memberIds: number[]
) => {
  const table = clusterType === "station" ? "stations" : "trains";
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM \`${table}\` WHERE id IN (?) AND division_id = ? AND status = 1`,
    [memberIds, divisionId]
  );
  const foundIds = new Set(rows.map((r) => r.id));
  const missing = memberIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `The following ${clusterType} IDs are not valid members of this division: ${missing.join(", ")}`
    );
  }
};

export const createCluster = async (data: IClusterCreate, userId: number) => {
  return withTransaction(async (conn) => {
    await assertMembersValid(conn, data.division_id, data.cluster_type, data.member_ids);

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO location_clusters (division_id, cluster_name, cluster_type, created_by) VALUES (?, ?, ?, ?)`,
      [data.division_id, data.cluster_name, data.cluster_type, userId]
    );
    const clusterId = result.insertId;

    const memberColumn = data.cluster_type === "station" ? "station_id" : "train_id";
    for (const memberId of data.member_ids) {
      await conn.execute(
        `INSERT INTO cluster_members (cluster_id, ${memberColumn}) VALUES (?, ?)`,
        [clusterId, memberId]
      );
    }

    return { id: clusterId, ...data };
  });
};

export const getClusters = async (filters: {
  search?: string;
  division_id?: number;
  cluster_type?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];
  const whereClauses = ["c.status = 1"];

  if (filters.search) {
    whereClauses.push("c.cluster_name LIKE ?");
    params.push(`%${filters.search}%`);
  }
  if (filters.division_id) {
    whereClauses.push("c.division_id = ?");
    params.push(filters.division_id);
  }
  if (filters.cluster_type) {
    whereClauses.push("c.cluster_type = ?");
    params.push(filters.cluster_type);
  }
  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM location_clusters c ${whereSql}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT c.*, d.division_name,
      (SELECT COUNT(*) FROM cluster_members cm WHERE cm.cluster_id = c.id) as member_count
    FROM location_clusters c
    LEFT JOIN divisions d ON d.id = c.division_id
    ${whereSql}
    ORDER BY c.cluster_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

export const getClusterById = async (id: string) => {
  const [clusterRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.*, d.division_name FROM location_clusters c LEFT JOIN divisions d ON d.id = c.division_id WHERE c.id = ? AND c.status = 1`,
    [id]
  );
  const cluster = clusterRows[0];
  if (!cluster) return null;

  const [members] = await pool.execute<RowDataPacket[]>(
    `SELECT cm.id as member_row_id, cm.station_id, cm.train_id,
       st.station_name, st.station_code, tr.train_name, tr.train_number
     FROM cluster_members cm
     LEFT JOIN stations st ON st.id = cm.station_id
     LEFT JOIN trains tr ON tr.id = cm.train_id
     WHERE cm.cluster_id = ?`,
    [id]
  );

  return { ...cluster, members };
};

export const editCluster = async (id: string, data: IClusterUpdate) => {
  return withTransaction(async (conn) => {
    const [clusterRows] = await conn.execute<RowDataPacket[]>(
      "SELECT * FROM location_clusters WHERE id = ? AND status = 1",
      [id]
    );
    const cluster = clusterRows[0];
    if (!cluster) throw new Error("Cluster not found");

    if (data.cluster_name !== undefined) {
      await conn.execute("UPDATE location_clusters SET cluster_name = ? WHERE id = ?", [data.cluster_name, id]);
    }

    if (data.member_ids !== undefined) {
      await assertMembersValid(conn, cluster.division_id, cluster.cluster_type, data.member_ids);
      await conn.execute("DELETE FROM cluster_members WHERE cluster_id = ?", [id]);
      const memberColumn = cluster.cluster_type === "station" ? "station_id" : "train_id";
      for (const memberId of data.member_ids) {
        await conn.execute(`INSERT INTO cluster_members (cluster_id, ${memberColumn}) VALUES (?, ?)`, [id, memberId]);
      }
    }

    return getClusterById(id);
  });
};

export const deleteCluster = async (id: string) => {
  const [inUse] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as cnt FROM units WHERE cluster_id = ? AND units_status != 'inactive'",
    [id]
  );
  if (Number(inUse[0]?.cnt ?? 0) > 0) {
    throw new Error("Cannot delete a cluster that is still linked to active units");
  }
  await pool.execute("UPDATE location_clusters SET status = 0 WHERE id = ?", [id]);
  return { id, deleted: true };
};
