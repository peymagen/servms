import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { type RowDataPacket } from "mysql2";

const NAVY = rgb(0.075, 0.16, 0.35);
const DARK = rgb(0.15, 0.15, 0.18);
const MUTED = rgb(0.45, 0.45, 0.5);

// Renders a simple multi-page tabular report of audit log rows.
export const renderAuditLogPdf = async (rows: RowDataPacket[]): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 792; // US Letter landscape
  const pageHeight = 612;
  const margin = 30;
  const rowHeight = 16;
  const columns = [
    { key: "created_at", label: "Timestamp", width: 100 },
    { key: "module_name", label: "Module", width: 90 },
    { key: "action", label: "Action", width: 70 },
    { key: "record_id", label: "Record", width: 55 },
    { key: "user_full_name", label: "Performed By", width: 100 },
    { key: "role_name", label: "Role", width: 90 },
    { key: "ip_address", label: "IP Address", width: 90 },
    { key: "details", label: "Details", width: 137 },
  ];

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: pageHeight - 34, width: pageWidth, height: 34, color: NAVY });
    page.drawText("SERVMS — Audit Log Export", { x: margin, y: pageHeight - 22, size: 12, font: bold, color: rgb(1, 1, 1) });
    y = pageHeight - 50;

    let x = margin;
    for (const col of columns) {
      page.drawText(col.label, { x, y, size: 7.5, font: bold, color: DARK });
      x += col.width;
    }
    y -= rowHeight;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: pageWidth - margin, y: y + 6 }, thickness: 0.5, color: MUTED });
  };

  drawHeader();

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = doc.addPage([pageWidth, pageHeight]);
      drawHeader();
    }
    let x = margin;
    for (const col of columns) {
      const raw = row[col.key];
      const text = raw == null ? "—" : String(raw);
      const truncated = font.widthOfTextAtSize(text, 7) > col.width - 4 ? `${text.slice(0, 40)}…` : text;
      page.drawText(truncated, { x, y, size: 7, font, color: DARK, maxWidth: col.width - 4 });
      x += col.width;
    }
    y -= rowHeight;
  }

  return doc.save();
};
