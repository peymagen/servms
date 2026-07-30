import * as XLSX from "xlsx";
import { type RowDataPacket } from "mysql2";
import { getInspectionsForExport, type InspectionFilters } from "./inspection.service";

const EXPORT_COLUMNS: Array<{ key: string; header: string }> = [
  { key: "inspection_no", header: "Inspection No." },
  { key: "division_name", header: "Division" },
  { key: "station_name", header: "Station" },
  { key: "train_number", header: "Train No." },
  { key: "unit_name", header: "Unit of Inspection" },
  { key: "inspecting_official_name", header: "Inspecting Official" },
  { key: "designation", header: "Designation" },
  { key: "place_of_posting", header: "Place of Posting" },
  { key: "inspection_category_label", header: "Inspection Category" },
  { key: "inspection_type_label", header: "Inspection Type" },
  { key: "inspection_date", header: "Inspection Date" },
  { key: "priority", header: "Priority" },
  { key: "inspection_status", header: "Status" },
  { key: "deficiencies", header: "Deficiencies" },
  { key: "closed_at", header: "Closed On" },
];

const toExportRows = (rows: RowDataPacket[]) =>
  rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of EXPORT_COLUMNS) {
      out[col.header] = row[col.key] ?? "";
    }
    return out;
  });

const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const buildInspectionsCsv = async (filters: InspectionFilters): Promise<string> => {
  const rows = await getInspectionsForExport(filters);
  const exportRows = toExportRows(rows);
  const headers = EXPORT_COLUMNS.map((c) => c.header);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of exportRows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
};

export const buildInspectionsWorkbook = async (filters: InspectionFilters): Promise<Buffer> => {
  const rows = await getInspectionsForExport(filters);
  const exportRows = toExportRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: EXPORT_COLUMNS.map((c) => c.header) });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inspections");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
