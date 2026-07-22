import { pool } from "../../common/services/sql.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── GET DIVISIONS ─────────────────────────────────────────────────────────────
export const getDivisions = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute("SELECT * FROM divisions ORDER BY division_name ASC");
  res.send(createResponse(rows));
});

// ─── GET STATIONS ──────────────────────────────────────────────────────────────
export const getStations = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id;
  let query = "SELECT * FROM stations";
  const params: any[] = [];

  if (divisionId) {
    query += " WHERE division_id = ?";
    params.push(divisionId);
  }
  query += " ORDER BY station_name ASC";

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── GET UNITS ─────────────────────────────────────────────────────────────────
export const getUnits = asyncHandler(async (req: Request, res: Response) => {
  const stationId = req.query.station_id;
  let query = "SELECT * FROM units";
  const params: any[] = [];

  if (stationId) {
    query += " WHERE station_id = ?";
    params.push(stationId);
  }
  query += " ORDER BY unit_name ASC";

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── GET CONTRACTORS ───────────────────────────────────────────────────────────
export const getContractors = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id;
  let query = "SELECT * FROM contractors";
  const params: any[] = [];

  if (divisionId) {
    query += " WHERE division_id = ?";
    params.push(divisionId);
  }
  query += " ORDER BY company_name ASC";

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── GET ROLES ─────────────────────────────────────────────────────────────────
export const getRoles = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute("SELECT * FROM roles WHERE roles_status = 'active'");
  res.send(createResponse(rows));
});
