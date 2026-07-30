import { pool } from "../../common/services/sql.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import * as XLSX from "xlsx";
import fs from "fs";

// ─── GET DIVISIONS ─────────────────────────────────────────────────────────────
export const getDivisions = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute("SELECT * FROM divisions ORDER BY division_name ASC");
  res.send(createResponse(rows));
});

// ─── GET STATIONS ──────────────────────────────────────────────────────────────
export const getStations = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id;
  let query = `
    SELECT s.*, d.division_name FROM stations s
    LEFT JOIN divisions d ON d.id = s.division_id
    WHERE s.status = 1
  `;
  const params: any[] = [];

  if (divisionId) {
    query += " AND s.division_id = ?";
    params.push(divisionId);
  }
  query += " ORDER BY s.station_name ASC";

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── CREATE STATION (individual entry) ──────────────────────────────────────────
export const createStation = asyncHandler(async (req: Request, res: Response) => {
  const { division_id, station_name, station_code, platform_count } = req.body;
  if (!division_id || !station_name || !station_code) {
    res.status(400).send(createResponse(null, "Division, Station Name, and Station Code are required"));
    return;
  }
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO stations (division_id, station_code, station_name, platform_count) VALUES (?, ?, ?, ?)",
    [division_id, station_code, station_name, platform_count ?? null]
  );
  res.send(createResponse({ id: result.insertId }, "Station created successfully"));
});

// ─── EDIT STATION ────────────────────────────────────────────────────────────────
export const editStation = asyncHandler(async (req: Request, res: Response) => {
  const { division_id, station_name, station_code, platform_count } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  if (division_id !== undefined) { updates.push("division_id = ?"); values.push(division_id); }
  if (station_name !== undefined) { updates.push("station_name = ?"); values.push(station_name); }
  if (station_code !== undefined) { updates.push("station_code = ?"); values.push(station_code); }
  if (platform_count !== undefined) { updates.push("platform_count = ?"); values.push(platform_count); }
  if (updates.length === 0) {
    res.status(400).send(createResponse(null, "No fields provided to update"));
    return;
  }
  values.push(req.params.id);
  await pool.execute(`UPDATE stations SET ${updates.join(", ")} WHERE id = ?`, values);
  res.send(createResponse({ id: req.params.id }, "Station updated successfully"));
});

// ─── DELETE STATION ──────────────────────────────────────────────────────────────
export const deleteStation = asyncHandler(async (req: Request, res: Response) => {
  const [inUse] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as cnt FROM units WHERE station_id = ? AND units_status != 'inactive'",
    [req.params.id]
  );
  if (Number(inUse[0]?.cnt ?? 0) > 0) {
    res.status(400).send(createResponse(null, "Cannot delete a station that is still linked to active units"));
    return;
  }
  await pool.execute("UPDATE stations SET status = 0 WHERE id = ?", [req.params.id]);
  res.send(createResponse({ id: req.params.id, deleted: true }, "Station removed successfully"));
});

// ─── BULK IMPORT STATIONS (Excel) ───────────────────────────────────────────────
// UAT: single-sheet workbook with columns "Division", "Station Name", "Station
// Code", "No of Platforms" — done by Divisional/HQ Admin or Sub-admin.
export const bulkImportStations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).send(createResponse(null, "An Excel file is required"));
    return;
  }

  const workbook = XLSX.readFile(req.file.path);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName as string];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet as XLSX.WorkSheet, { defval: "" });

  fs.unlink(req.file.path, () => {});

  const [divisionRows] = await pool.execute<RowDataPacket[]>("SELECT id, division_name FROM divisions WHERE status = 1");
  const divisionByName = new Map(divisionRows.map((d) => [String(d.division_name).trim().toLowerCase(), d.id]));

  const inserted: string[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const divisionName = String(row["Division"] ?? "").trim();
    const stationName = String(row["Station Name"] ?? "").trim();
    const stationCode = String(row["Station Code"] ?? "").trim();
    const platformCountRaw = row["No of Platforms"] ?? row["No. of Platforms"] ?? "";
    const platformCount = platformCountRaw !== "" ? Number(platformCountRaw) : null;
    const rowNum = i + 2; // account for header row

    if (!divisionName || !stationName || !stationCode) {
      skipped.push({ row: rowNum, reason: "Missing Division, Station Name, or Station Code" });
      continue;
    }
    const divisionId = divisionByName.get(divisionName.toLowerCase());
    if (!divisionId) {
      skipped.push({ row: rowNum, reason: `Unknown division "${divisionName}"` });
      continue;
    }

    try {
      await pool.execute(
        "INSERT INTO stations (division_id, station_code, station_name, platform_count) VALUES (?, ?, ?, ?)",
        [divisionId, stationCode, stationName, platformCount]
      );
      inserted.push(stationCode);
    } catch (err: any) {
      skipped.push({ row: rowNum, reason: err?.code === "ER_DUP_ENTRY" ? `Station code "${stationCode}" already exists` : "Insert failed" });
    }
  }

  res.send(
    createResponse(
      { insertedCount: inserted.length, skippedCount: skipped.length, inserted, skipped },
      `Imported ${inserted.length} station(s), skipped ${skipped.length}`
    )
  );
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

// ─── GET VENDORS (lite, optionally scoped to a contractor) ─────────────────────
export const getVendorsLite = asyncHandler(async (req: Request, res: Response) => {
  const contractorId = req.query.contractor_id;
  let query = "SELECT id, vendor_code, full_name, contractor_id, unit_id, division_id FROM vendors WHERE status = 1";
  const params: any[] = [];

  if (contractorId) {
    query += " AND contractor_id = ?";
    params.push(contractorId);
  }
  query += " ORDER BY full_name ASC";

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── GET COMPLAINTS (lite, for penalty reference picker) ───────────────────────
export const getComplaintsLite = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute(
    `SELECT id, complaint_code, category, occurrence_date FROM complaints
     WHERE status = 1 ORDER BY created_at DESC LIMIT 200`
  );
  res.send(createResponse(rows));
});

// ─── GET INSPECTIONS (lite, for penalty reference picker) ──────────────────────
export const getInspectionsLite = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute(
    `SELECT i.id, i.unit_id, u.unit_name, i.inspection_date, i.result FROM inspections i
     LEFT JOIN units u ON u.id = i.unit_id
     WHERE i.status = 1 ORDER BY i.inspection_date DESC LIMIT 200`
  );
  res.send(createResponse(rows));
});

// ─── GET ROLES ─────────────────────────────────────────────────────────────────
export const getRoles = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute("SELECT * FROM roles WHERE roles_status = 'active' AND status = 1");
  res.send(createResponse(rows));
});

// ─── GET ZONES ─────────────────────────────────────────────────────────────────
export const getZones = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute("SELECT * FROM zones WHERE status = 1 ORDER BY zone_name ASC");
  res.send(createResponse(rows));
});
