import * as auditService from "./audit.service";
import { renderAuditLogPdf } from "./audit.pdf";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

const readFilters = (req: Request) => ({
  module: req.query.module ? String(req.query.module) : undefined,
  recordId: req.query.record_id ? String(req.query.record_id) : undefined,
  userId: req.query.user_id ? String(req.query.user_id) : undefined,
  action: req.query.action ? String(req.query.action) : undefined,
  from: req.query.from ? String(req.query.from) : undefined,
  to: req.query.to ? String(req.query.to) : undefined,
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditService.getAuditLogs({
    ...readFilters(req),
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.send(createResponse(result));
});

export const getAuditModules = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditService.getDistinctModules();
  res.send(createResponse(result));
});

// ─── EXPORT: EXCEL (CSV) ─────────────────────────────────────────────────────────
export const exportAuditLogsCsv = asyncHandler(async (req: Request, res: Response) => {
  const rows = await auditService.getAuditLogsForExport(readFilters(req));
  const headers = ["Timestamp", "Module", "Action", "Record ID", "Performed By", "Role", "IP Address", "Details"];
  const csvRows = rows.map((r) => [
    r.created_at, r.module_name ?? "", r.action, r.record_id ?? "", r.user_full_name ?? "", r.role_name ?? "", r.ip_address ?? "", r.details ?? "",
  ]);
  const csv = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  await logAudit({ req, module: "audit_logs", action: "EXPORT", details: "CSV export" });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-logs.csv"');
  res.send(csv);
});

// ─── EXPORT: PDF ─────────────────────────────────────────────────────────────────
export const exportAuditLogsPdf = asyncHandler(async (req: Request, res: Response) => {
  const rows = await auditService.getAuditLogsForExport(readFilters(req));
  const pdfBytes = await renderAuditLogPdf(rows);

  await logAudit({ req, module: "audit_logs", action: "EXPORT", details: "PDF export" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-logs.pdf"');
  res.send(Buffer.from(pdfBytes));
});
