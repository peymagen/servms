import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";

// ─── CREATE PENALTY ────────────────────────────────────────────────────────────
export const createPenalty = async (data: any, userId: number) => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const penaltyCode = `PNL-2026-${randomNum}`;

  const query = `
    INSERT INTO penalties (
      penalty_code, contractor_id, vendor_id, unit_id, amount, reason,
      penalties_status, issued_by, issued_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    penaltyCode,
    data.contractor_id,
    data.vendor_id ?? null,
    data.unit_id ?? null,
    data.amount,
    data.reason,
    data.penalties_status ?? "pending",
    userId,
    data.issued_date ?? new Date().toISOString().split("T")[0]
  ];

  const [result] = await pool.execute<ResultSetHeader>(query, values);
  return { id: result.insertId, penalty_code: penaltyCode };
};

// ─── GET PENALTIES (WITH SEARCH AND FILTERS) ─────────────────────────────────────
export const getPenalties = async (filters: {
  search?: string;
  division_id?: number;
  contractor_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  const params: any[] = [];
  const countParams: any[] = [];

  let whereClauses = ["p.status = 1"];

  if (filters.search) {
    whereClauses.push("(p.penalty_code LIKE ? OR p.reason LIKE ? OR c.company_name LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (filters.division_id) {
    whereClauses.push("(c.division_id = ? OR st.division_id = ?)");
    params.push(filters.division_id, filters.division_id);
    countParams.push(filters.division_id, filters.division_id);
  }

  if (filters.contractor_id) {
    whereClauses.push("p.contractor_id = ?");
    params.push(filters.contractor_id);
    countParams.push(filters.contractor_id);
  }

  if (filters.status) {
    whereClauses.push("p.penalties_status = ?");
    params.push(filters.status);
    countParams.push(filters.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM penalties p
    LEFT JOIN contractors c ON c.id = p.contractor_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    ${whereSql}
  `;
  const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
  const total = countRows[0]?.total ?? 0;

  // Get rows
  const query = `
    SELECT 
      p.*,
      c.company_name as contractor_name,
      v.full_name as vendor_name,
      u.unit_name,
      st.station_name,
      d.division_name,
      us.full_name as issued_by_name
    FROM penalties p
    LEFT JOIN contractors c ON c.id = p.contractor_id
    LEFT JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN divisions d ON d.id = COALESCE(c.division_id, st.division_id)
    LEFT JOIN users us ON us.id = p.issued_by
    ${whereSql}
    ORDER BY p.issued_date DESC, p.created_at DESC
    LIMIT ${Number.isInteger(limit) ? limit : 10} OFFSET ${Number.isInteger(offset) ? offset : 0}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);

  return { total, rows };
};

// ─── GET PENALTY BY ID ───────────────────────────────────────────────────────────
export const getPenaltyById = async (id: string) => {
  const query = `
    SELECT 
      p.*,
      c.company_name as contractor_name,
      v.full_name as vendor_name,
      u.unit_name,
      st.station_name,
      d.division_name,
      us.full_name as issued_by_name
    FROM penalties p
    LEFT JOIN contractors c ON c.id = p.contractor_id
    LEFT JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN divisions d ON d.id = COALESCE(c.division_id, st.division_id)
    LEFT JOIN users us ON us.id = p.issued_by
    WHERE p.id = ? AND p.status = 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
  return rows[0] ?? null;
};

// ─── UPDATE PENALTY (PATCH) ──────────────────────────────────────────────────────
export const editPenalty = async (id: string, data: any) => {
  const updates: string[] = [];
  const values: any[] = [];

  const allowedFields = ["penalties_status", "amount", "reason", "resolution_date"];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`\`${field}\` = ?`);
      values.push(data[field]);
    }
  }

  if (data.penalties_status === "recovered" && !data.resolution_date) {
    updates.push("resolution_date = ?");
    values.push(new Date().toISOString().split("T")[0]);
  }

  if (updates.length === 0) {
    throw new Error("No fields provided to update");
  }

  values.push(id);
  const query = `UPDATE penalties SET ${updates.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
  return { id, ...data };
};

// ─── GET PENALTY METRICS ────────────────────────────────────────────────────────
export const getPenaltyMetrics = async (divisionId?: number) => {
  const params: any[] = [];
  let whereSql = "p.status = 1";

  if (divisionId) {
    whereSql += " AND (c.division_id = ? OR st.division_id = ?)";
    params.push(divisionId, divisionId);
  }

  const query = `
    SELECT 
      COUNT(*) as total_cases,
      SUM(amount) as total_imposed,
      SUM(CASE WHEN penalties_status = 'recovered' THEN amount ELSE 0 END) as total_recovered,
      SUM(CASE WHEN penalties_status = 'pending' THEN amount ELSE 0 END) as total_outstanding,
      SUM(CASE WHEN reason LIKE '%HYGIENE%' OR reason LIKE '%EXPIRED%' THEN amount ELSE 0 END) as hygiene_lapse_amt,
      SUM(CASE WHEN reason LIKE '%OVERCHARGING%' THEN amount ELSE 0 END) as overcharging_amt,
      SUM(CASE WHEN reason LIKE '%VENDING%' OR reason LIKE '%UNAUTHORIZED%' THEN amount ELSE 0 END) as vending_amt
    FROM penalties p
    LEFT JOIN contractors c ON c.id = p.contractor_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    WHERE ${whereSql}
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  const stats = rows[0] || {};

  const totalImposed = Number(stats.total_imposed ?? 0);
  const totalRecovered = Number(stats.total_recovered ?? 0);
  const recoveryRate = totalImposed > 0 ? (totalRecovered / totalImposed) * 100 : 0;

  // Retrieve top outstanding payments for alerts
  const alertQuery = `
    SELECT 
      p.penalty_code,
      c.company_name as contractor_name,
      p.amount,
      p.reason,
      p.issued_date
    FROM penalties p
    LEFT JOIN contractors c ON c.id = p.contractor_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN stations st ON st.id = u.station_id
    WHERE ${whereSql} AND p.penalties_status = 'pending'
    ORDER BY p.amount DESC, p.issued_date ASC
    LIMIT 3
  `;
  const [alerts] = await pool.execute<RowDataPacket[]>(alertQuery, params);

  return {
    totalCases: Number(stats.total_cases ?? 0),
    totalImposed: totalImposed,
    totalRecovered: totalRecovered,
    outstandingAmount: Number(stats.total_outstanding ?? 0),
    recoveryRate: Math.round(recoveryRate * 10) / 10,
    hygieneLapseAmt: Number(stats.hygiene_lapse_amt ?? 0),
    overchargingAmt: Number(stats.overcharging_amt ?? 0),
    vendingAmt: Number(stats.vending_amt ?? 0),
    alerts: alerts
  };
};
