import * as XLSX from "xlsx";
import { pool } from "../../common/services/sql.service";
import { type ResultSetHeader } from "mysql2";
import { resolveModuleOrThrow, generateReport } from "./report.service";
import { type GenerateReportInput } from "./report.dto";
import { getReportField } from "./report.registry";

interface ExportMeta {
  exportedByName: string;
  format: "xlsx" | "csv";
  fileName: string;
}

const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const toLabeledRows = (moduleKey: string, fieldKeys: string[], rows: Record<string, unknown>[]) => {
  const moduleDef = resolveModuleOrThrow(moduleKey);
  const headers = fieldKeys.map((key) => getReportField(moduleDef, key)?.label ?? key);
  const labeled = rows.map((row) => {
    const out: Record<string, unknown> = {};
    fieldKeys.forEach((key, i) => {
      out[headers[i]!] = row[key] ?? "";
    });
    return out;
  });
  return { headers, labeled };
};

export const buildReportCsv = (moduleKey: string, fieldKeys: string[], rows: Record<string, unknown>[], meta: ExportMeta): string => {
  const { headers, labeled } = toLabeledRows(moduleKey, fieldKeys, rows);
  const lines = [
    `# Exported by: ${meta.exportedByName}`,
    `# Export date: ${new Date().toLocaleString("en-IN")}`,
    `# Module: ${moduleKey}`,
    headers.map(csvEscape).join(","),
  ];
  for (const row of labeled) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
};

export const buildReportWorkbook = (
  moduleKey: string,
  fieldKeys: string[],
  rows: Record<string, unknown>[],
  meta: ExportMeta,
  filters?: unknown
): Buffer => {
  const { headers, labeled } = toLabeledRows(moduleKey, fieldKeys, rows);
  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet(labeled, { header: headers });
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Data");

  const infoRows = [
    { Field: "Module", Value: moduleKey },
    { Field: "Exported By", Value: meta.exportedByName },
    { Field: "Export Date/Time", Value: new Date().toLocaleString("en-IN") },
    { Field: "Row Count", Value: rows.length },
    { Field: "Applied Filters", Value: filters ? JSON.stringify(filters) : "None" },
  ];
  const infoSheet = XLSX.utils.json_to_sheet(infoRows, { header: ["Field", "Value"] });
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Export Info");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

export const recordExport = async (opts: {
  reportTemplateId?: number | null;
  moduleKey: string;
  format: "xlsx" | "csv";
  filters?: unknown;
  rowCount: number;
  fileName: string;
  exportedBy: number;
}) => {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO report_exports (report_template_id, module_key, export_format, filters_snapshot, row_count, file_name, exported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      opts.reportTemplateId ?? null,
      opts.moduleKey,
      opts.format,
      opts.filters ? JSON.stringify(opts.filters) : null,
      opts.rowCount,
      opts.fileName,
      opts.exportedBy,
    ]
  );
  return { id: result.insertId };
};

export const generateAndExport = async (
  input: GenerateReportInput,
  format: "xlsx" | "csv",
  exportedByName: string,
  forcedDivisionId?: number
) => {
  const result = await generateReport({ ...input, limit: 5000, offset: 0 }, forcedDivisionId);
  const fileName = `${input.module_key}-report.${format}`;
  const meta: ExportMeta = { exportedByName, format, fileName };
  const body = format === "csv"
    ? buildReportCsv(input.module_key, input.fields, result.rows as any, meta)
    : buildReportWorkbook(input.module_key, input.fields, result.rows as any, meta, input.filters);
  return { body, fileName, rowCount: result.rows.length };
};
