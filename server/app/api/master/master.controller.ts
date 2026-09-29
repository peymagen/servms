import { pool } from "../../common/services/sql.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import * as XLSX from "xlsx";
import fs from "fs";
import { isDivisionScoped, pinToOwnDivision, assertInOwnDivision } from "../../common/constants/roles";
import createHttpError from "http-errors";

// Division-scoped users may only edit/remove stations in their own division.
const assertStationAccessible = async (req: Request) => {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT division_id FROM stations WHERE id = ? AND status = 1", [
    req.params.id,
  ]);
  if (!rows[0]) throw createHttpError(404, "Station not found");
  try {
    assertInOwnDivision(req.user as any, rows[0].division_id, "This station");
  } catch {
    throw createHttpError(404, "Station not found");
  }
};

// ─── GET DIVISIONS ─────────────────────────────────────────────────────────────
export const getDivisions = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.execute("SELECT * FROM divisions ORDER BY division_name ASC");
  res.send(createResponse(rows));
});

// ─── GET STATIONS ──────────────────────────────────────────────────────────────
export const getStations = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const divisionId = isDivisionScoped(user?.role_name) ? user.division_id : req.query.division_id;
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
  pinToOwnDivision(req.user as any, req.body);
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
  await assertStationAccessible(req);
  // Moving a station to another division is an HQ-level change.
  if (isDivisionScoped((req.user as any)?.role_name)) delete req.body.division_id;
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
  await assertStationAccessible(req);
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
  // Divisional users can only import rows for their own division.
  const importer = req.user as any;
  const restrictDivisionId = isDivisionScoped(importer?.role_name) ? importer.division_id : null;

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
    if (restrictDivisionId != null && Number(divisionId) !== Number(restrictDivisionId)) {
      skipped.push({ row: rowNum, reason: `Division "${divisionName}" is not your division` });
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
// This "lite" picker previously returned every unit org-wide regardless of the
// caller's role — scoped the same way unit.service.ts's full endpoint is.
export const getUnits = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const stationId = req.query.station_id;
  const whereClauses = ["1 = 1"];
  const params: any[] = [];

  let query = `
    SELECT u.*, COALESCE(st.division_id, tr.division_id, cl.division_id) AS division_id FROM units u
    LEFT JOIN stations st ON st.id = u.station_id
    LEFT JOIN trains tr ON tr.id = u.train_id
    LEFT JOIN location_clusters cl ON cl.id = u.cluster_id
  `;

  if (stationId) {
    whereClauses.push("u.station_id = ?");
    params.push(stationId);
  }
  if (isDivisionScoped(user?.role_name) && user?.division_id) {
    whereClauses.push("COALESCE(st.division_id, tr.division_id, cl.division_id) = ?");
    params.push(user.division_id);
  }
  query += ` WHERE ${whereClauses.join(" AND ")} ORDER BY u.unit_name ASC`;

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── GET CONTRACTORS ───────────────────────────────────────────────────────────
export const getContractors = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let divisionId = req.query.division_id;
  if (isDivisionScoped(user?.role_name) && user?.division_id) {
    divisionId = user.division_id;
  }

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
  const user = req.user as any;
  const contractorId = req.query.contractor_id;
  let query = "SELECT id, vendor_code, full_name, contractor_id, unit_id, division_id FROM vendors WHERE status = 1";
  const params: any[] = [];

  if (contractorId) {
    query += " AND contractor_id = ?";
    params.push(contractorId);
  }
  if (isDivisionScoped(user?.role_name) && user?.division_id) {
    query += " AND division_id = ?";
    params.push(user.division_id);
  }
  query += " ORDER BY full_name ASC";

  const [rows] = await pool.execute(query, params);
  res.send(createResponse(rows));
});

// ─── GET COMPLAINTS (lite, for penalty reference picker) ───────────────────────
export const getComplaintsLite = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const whereClauses = ["status = 1"];
  const params: any[] = [];
  if (isDivisionScoped(user?.role_name) && user?.division_id) {
    whereClauses.push("division_id = ?");
    params.push(user.division_id);
  }
  const [rows] = await pool.execute(
    `SELECT id, complaint_code, category, occurrence_date FROM complaints
     WHERE ${whereClauses.join(" AND ")} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  res.send(createResponse(rows));
});

// ─── GET INSPECTIONS (lite, for penalty reference picker) ──────────────────────
export const getInspectionsLite = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const whereClauses = ["i.status = 1"];
  const params: any[] = [];
  if (isDivisionScoped(user?.role_name) && user?.division_id) {
    whereClauses.push("i.division_id = ?");
    params.push(user.division_id);
  }
  const [rows] = await pool.execute(
    `SELECT i.id, i.unit_id, u.unit_name, i.inspection_date, i.result FROM inspections i
     LEFT JOIN units u ON u.id = i.unit_id
     WHERE ${whereClauses.join(" AND ")} ORDER BY i.inspection_date DESC LIMIT 200`,
    params
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
