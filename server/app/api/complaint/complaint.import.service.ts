import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import * as XLSX from "xlsx";
import fs from "fs";

interface RailMadadRow {
  complaintRefNo?: string | number;
  createdOn?: string;
  modifiedOn?: string;
  complaintMode?: string;
  trainStation?: string | number;
  compTypeName?: string;
  subTypeName?: string;
  divCode?: string;
  status?: string;
  complaintDesc?: string;
  remarks?: string;
  userMobile?: string | number;
  trainNameForReport?: string;
  [key: string]: unknown;
}

const RAILMADAD_STATUS_MAP: Record<string, string> = {
  closed: "closed",
  open: "pending",
  pending: "pending",
  "in progress": "action_taken",
};

// RailMadad exports dates as "DD-MM-YY HH:mm" — convert to a MySQL DATETIME.
const parseRailMadadDate = (value: string | undefined): Date | null => {
  if (!value || value === "null") return null;
  const match = /^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yy, hh, min] = match;
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
};

const cleanString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === "" || str.toLowerCase() === "null" ? null : str;
};

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

// Finds (or, for Type/Sub-type, creates) the dropdown_options row for a given
// category/label pair — RailMadad's own vocabulary may not exactly match the
// seeded set, and the SRS asks us to map columns rather than change the source
// file, so unrecognized types/subtypes are added to the managed dropdown
// instead of silently discarding the row's classification.
const resolveOrCreateDropdown = async (
  cache: Map<string, number>,
  category: "complaint_type" | "complaint_subtype",
  label: string,
  parentId: number | null,
  userId: number
): Promise<number> => {
  const key = `${category}:${parentId ?? "root"}:${label.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) as number;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM dropdown_options WHERE category = ? AND LOWER(label) = ? AND (parent_id <=> ?) LIMIT 1`,
    [category, label.toLowerCase(), parentId]
  );
  if (rows.length) {
    cache.set(key, rows[0]!.id);
    return rows[0]!.id;
  }

  const value = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO dropdown_options (category, parent_id, division_id, value, label, sort_order, created_by) VALUES (?, ?, NULL, ?, ?, 99, ?)`,
    [category, parentId, value, label, userId]
  );
  cache.set(key, result.insertId);
  return result.insertId;
};

export const importRailMadadComplaints = async (
  filePath: string,
  fileName: string,
  userId: number
): Promise<ImportSummary> => {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0] as string];
  const rows = XLSX.utils.sheet_to_json<RailMadadRow>(sheet as XLSX.WorkSheet, { defval: "" });
  fs.unlink(filePath, () => {});

  const [divisionRows] = await pool.execute<RowDataPacket[]>("SELECT id, division_code FROM divisions WHERE status = 1");
  const divisionByCode = new Map(divisionRows.map((d) => [String(d.division_code).trim().toUpperCase(), d.id]));

  const [stationRows] = await pool.execute<RowDataPacket[]>("SELECT id, station_code FROM stations WHERE status = 1");
  const stationByCode = new Map(stationRows.map((s) => [String(s.station_code).trim().toUpperCase(), s.id]));

  const [trainRows] = await pool.execute<RowDataPacket[]>("SELECT id, train_number FROM trains WHERE status = 1");
  const trainByNumber = new Map(trainRows.map((t) => [String(t.train_number).trim(), t.id]));

  const dropdownCache = new Map<string, number>();

  let importedCount = 0;
  let duplicateCount = 0;
  const failed: ImportRowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as RailMadadRow;
    const rowNum = i + 2;

    const refNo = cleanString(row.complaintRefNo);
    const description = cleanString(row.complaintDesc);

    // Skip fully empty rows.
    const hasAnyValue = Object.values(row).some((v) => cleanString(v) !== null);
    if (!hasAnyValue) continue;

    if (!refNo || !description) {
      failed.push({ row: rowNum, reason: "Missing Complaint Reference Number or Complaint Description" });
      continue;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM complaints WHERE complaint_source = 'railmadad' AND complaint_ref_no = ?",
      [refNo]
    );
    if (existing.length) {
      duplicateCount++;
      continue;
    }

    const divCode = cleanString(row.divCode)?.toUpperCase() ?? null;
    const divisionId = divCode ? divisionByCode.get(divCode) ?? null : null;

    const complaintMode = cleanString(row.complaintMode);
    const trainStationRaw = cleanString(row.trainStation);
    let trainId: number | null = null;
    let stationId: number | null = null;
    if (trainStationRaw) {
      if (complaintMode === "T") {
        trainId = trainByNumber.get(trainStationRaw) ?? null;
      } else {
        stationId = stationByCode.get(trainStationRaw.toUpperCase()) ?? null;
      }
    }

    const typeLabel = cleanString(row.compTypeName) ?? "Miscellaneous";
    const subTypeLabel = cleanString(row.subTypeName) ?? "Miscellaneous";

    try {
      const typeId = await resolveOrCreateDropdown(dropdownCache, "complaint_type", typeLabel, null, userId);
      const subtypeId = await resolveOrCreateDropdown(dropdownCache, "complaint_subtype", subTypeLabel, typeId, userId);

      const complaintDate = parseRailMadadDate(row.createdOn) ?? new Date();
      const modifiedDate = parseRailMadadDate(row.modifiedOn);
      const railMadadStatus = cleanString(row.status)?.toLowerCase() ?? "";
      const mappedStatus = RAILMADAD_STATUS_MAP[railMadadStatus] ?? "pending";

      const extraKeys = [
        "finalStatus", "avgcDiff", "primaryDepot", "channelType", "zoneCode", "ownZoneCode", "deptCode",
        "sla", "rating", "diff", "ownDivCode", "commodity", "forwarded", "pnrUtsNo", "coachType", "coachNo",
        "feedbackRemark", "nextStation", "contactId", "physicalCoachNo", "trainNameForReport", "userId",
        "Coach Owning Railway", "Previous Watering Station", "Next Watering Station",
      ];
      const extra: Record<string, unknown> = {};
      for (const key of extraKeys) {
        const value = cleanString((row as Record<string, unknown>)[key]);
        if (value !== null) extra[key] = value;
      }

      const complaintCode = `CMP-${Math.floor(10000 + Math.random() * 90000)}`;
      const isClosed = mappedStatus === "closed";

      const [insertResult] = await pool.execute<ResultSetHeader>(
        `INSERT INTO complaints (
          complaint_code, complaint_source, complaint_ref_no, division_id, train_id, station_id,
          complaint_type_id, complaint_subtype_id, description, complainant_mobile,
          complaint_date, priority, complaints_status, registered_by,
          closed_at, railmadad_extra
        ) VALUES (?, 'railmadad', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medium', ?, ?, ?, ?)`,
        [
          complaintCode,
          refNo,
          divisionId,
          trainId,
          stationId,
          typeId,
          subtypeId,
          description,
          cleanString(row.userMobile),
          complaintDate,
          mappedStatus,
          userId,
          isClosed ? modifiedDate ?? complaintDate : null,
          JSON.stringify(extra),
        ]
      );

      const complaintId = insertResult.insertId;
      await pool.execute(
        `INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, remarks) VALUES (?, NULL, ?, ?, ?)`,
        [complaintId, mappedStatus, userId, "Imported from RailMadad Excel"]
      );

      const resolutionRemarks = cleanString(row.remarks);
      if (isClosed && resolutionRemarks) {
        await pool.execute(
          `INSERT INTO complaint_action_taken_reports
            (complaint_id, remarks, submitted_at, review_status, decided_at, decision_remarks)
           VALUES (?, ?, ?, 'accepted', ?, ?)`,
          [complaintId, resolutionRemarks, modifiedDate ?? complaintDate, modifiedDate ?? complaintDate, resolutionRemarks]
        );
      }

      importedCount++;
    } catch (err: any) {
      failed.push({ row: rowNum, reason: err?.message ?? "Insert failed" });
    }
  }

  const [historyResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO complaint_import_history (file_name, imported_by, total_records, imported_count, duplicate_count, failed_count, error_report)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fileName, userId, rows.length, importedCount, duplicateCount, failed.length, JSON.stringify(failed)]
  );

  return {
    importId: historyResult.insertId,
    totalRecords: rows.length,
    importedCount,
    duplicateCount,
    failedCount: failed.length,
    failed,
  };
};

export const getImportHistory = async (limit = 50) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ih.*, u.full_name as imported_by_name FROM complaint_import_history ih
     LEFT JOIN users u ON u.id = ih.imported_by
     ORDER BY ih.created_at DESC LIMIT ${Number.isInteger(limit) ? limit : 50}`
  );
  return rows;
};
