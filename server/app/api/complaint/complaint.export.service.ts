import * as XLSX from "xlsx";
import { type RowDataPacket } from "mysql2";
import { getComplaintsForExport, type ComplaintFilters } from "./complaint.service";

const EXPORT_COLUMNS: Array<{ key: string; header: string }> = [
  { key: "complaint_code", header: "Complaint Code" },
  { key: "complaint_source", header: "Source" },
  { key: "complaint_ref_no", header: "Reference No." },
  { key: "division_name", header: "Division" },
  { key: "station_name", header: "Station" },
  { key: "train_number", header: "Train No." },
  { key: "unit_name", header: "Concerned Unit" },
  { key: "complaint_type_label", header: "Complaint Type" },
  { key: "complaint_subtype_label", header: "Complaint Sub-Type" },
  { key: "description", header: "Description" },
  { key: "complainant_name", header: "Complainant Name" },
  { key: "complainant_mobile", header: "Complainant Mobile" },
  { key: "priority", header: "Priority" },
  { key: "complaints_status", header: "Status" },
  { key: "complaint_date", header: "Complaint Date" },
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

export const buildComplaintsCsv = async (filters: ComplaintFilters): Promise<string> => {
  const rows = await getComplaintsForExport(filters);
  const exportRows = toExportRows(rows);
  const headers = EXPORT_COLUMNS.map((c) => c.header);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of exportRows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
};

export const buildComplaintsWorkbook = async (filters: ComplaintFilters): Promise<Buffer> => {
  const rows = await getComplaintsForExport(filters);
  const exportRows = toExportRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: EXPORT_COLUMNS.map((c) => c.header) });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Complaints");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
