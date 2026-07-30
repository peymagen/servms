import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import * as XLSX from "xlsx";
import fs from "fs";
import createHttpError from "http-errors";

export interface ImportRowError {
  row: number;
  reason: string;
}

export interface ImportSummary {
  importId: number;
  totalRecords: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  failed: ImportRowError[];
}

interface MasterImportDef {
  key: string;
  label: string;
  templateColumns: string[];
  // Inserts a single row; throws to record a per-row failure, returns nothing
  // on success. `duplicate` is signalled by throwing an Error with a message
  // starting "DUPLICATE:" so the generic runner can bucket it correctly.
  importRow: (row: Record<string, unknown>) => Promise<void>;
}

const cell = (row: Record<string, unknown>, key: string): string => String(row[key] ?? "").trim();

// Reference implementation — mirrors master.controller.ts's bulkImportStations
// exactly (same columns, same division-by-name lookup, same duplicate
// handling) so importing via the Reports module's generic Import Management
// screen behaves identically to the existing Location Masters bulk-import.
// Additional masters register here as they're wired into the Reports module.
const MASTER_IMPORTS: Record<string, MasterImportDef> = {
  stations: {
    key: "stations",
    label: "Stations",
    templateColumns: ["Division", "Station Name", "Station Code", "No of Platforms"],
    importRow: async (row) => {
      const divisionName = cell(row, "Division");
      const stationName = cell(row, "Station Name");
      const stationCode = cell(row, "Station Code");
      const platformCountRaw = row["No of Platforms"] ?? row["No. of Platforms"] ?? "";
      const platformCount = platformCountRaw !== "" ? Number(platformCountRaw) : null;

      if (!divisionName || !stationName || !stationCode) {
        throw new Error("Missing Division, Station Name, or Station Code");
      }

      const [divisionRows] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM divisions WHERE LOWER(division_name) = ? AND status = 1",
        [divisionName.toLowerCase()]
      );
      if (!divisionRows.length) {
        throw new Error(`Unknown division "${divisionName}"`);
      }

      try {
        await pool.execute(
          "INSERT INTO stations (division_id, station_code, station_name, platform_count) VALUES (?, ?, ?, ?)",
          [divisionRows[0]!.id, stationCode, stationName, platformCount]
        );
      } catch (err: any) {
        if (err?.code === "ER_DUP_ENTRY") throw new Error(`DUPLICATE: Station code "${stationCode}" already exists`);
        throw err;
      }
    },
  },
};

export const listImportableMasters = () =>
  Object.values(MASTER_IMPORTS).map((m) => ({ key: m.key, label: m.label, templateColumns: m.templateColumns }));

export const buildMasterTemplate = (masterKey: string): Buffer => {
  const def = MASTER_IMPORTS[masterKey];
  if (!def) throw createHttpError(400, `Unknown master "${masterKey}"`);
  const worksheet = XLSX.utils.json_to_sheet([], { header: def.templateColumns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, def.label);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

export const importMasterData = async (masterKey: string, filePath: string, fileName: string, userId: number): Promise<ImportSummary> => {
  const def = MASTER_IMPORTS[masterKey];
  if (!def) {
    fs.unlink(filePath, () => {});
    throw createHttpError(400, `Unknown master "${masterKey}"`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0] as string];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet as XLSX.WorkSheet, { defval: "" });
  fs.unlink(filePath, () => {});

  let importedCount = 0;
  let duplicateCount = 0;
  const failed: ImportRowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const rowNum = i + 2;
    const hasAnyValue = Object.values(row).some((v) => String(v ?? "").trim() !== "");
    if (!hasAnyValue) continue;

    try {
      await def.importRow(row);
      importedCount++;
    } catch (err: any) {
      const message = err?.message ?? "Insert failed";
      if (message.startsWith("DUPLICATE:")) {
        duplicateCount++;
      } else {
        failed.push({ row: rowNum, reason: message });
      }
    }
  }

  const [historyResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO report_import_logs (master_key, file_name, imported_by, total_records, imported_count, duplicate_count, failed_count, error_report)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [masterKey, fileName, userId, rows.length, importedCount, duplicateCount, failed.length, JSON.stringify(failed)]
  );

  return { importId: historyResult.insertId, totalRecords: rows.length, importedCount, duplicateCount, failedCount: failed.length, failed };
};

export const getImportHistory = async (masterKey?: string, limit = 50) => {
  const clauses: string[] = [];
  const params: any[] = [];
  if (masterKey) {
    clauses.push("il.master_key = ?");
    params.push(masterKey);
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT il.*, u.full_name as imported_by_name FROM report_import_logs il
     LEFT JOIN users u ON u.id = il.imported_by
     ${whereSql}
     ORDER BY il.created_at DESC LIMIT ${Number.isInteger(limit) ? limit : 50}`,
    params
  );
  return rows;
};
