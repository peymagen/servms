import * as reportService from "./report.service";
import * as exportService from "./report.export.service";
import { resolveModuleOrThrow } from "./report.service";
import { listReportModules } from "./report.registry";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";

const currentUser = (req: Request) => req.user as any;

const resolveForcedDivisionId = (req: Request): number | undefined => {
  const user = currentUser(req);
  return isDivisionScoped(user?.role_name) ? user.division_id : undefined;
};

// ─── METADATA: list reportable modules + their whitelisted fields ─────────────
export const getReportModules = asyncHandler(async (req: Request, res: Response) => {
  const modules = listReportModules().map((m) => ({
    key: m.key,
    label: m.label,
    fields: m.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      filterable: f.filterable,
      sortable: f.sortable,
      groupable: f.groupable,
      enumValues: f.enumValues,
    })),
  }));
  res.send(createResponse(modules));
});

// ─── GENERATE / PREVIEW a report (no persistence) ──────────────────────────────
export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const moduleDef = resolveModuleOrThrow(req.body.module_key);
  await reportService.assertModuleAccess(user, moduleDef, "view");

  const result = await reportService.generateReport(req.body, resolveForcedDivisionId(req));
  res.send(createResponse(result));
});

// ─── EXPORT a report to Excel/CSV ──────────────────────────────────────────────
export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const moduleDef = resolveModuleOrThrow(req.body.module_key);
  await reportService.assertModuleAccess(user, moduleDef, "export");

  const format = req.body.format as "xlsx" | "csv";
  const { body, fileName, rowCount } = await exportService.generateAndExport(
    req.body,
    format,
    user.full_name ?? user.username ?? "Unknown",
    resolveForcedDivisionId(req)
  );

  await exportService.recordExport({
    reportTemplateId: req.body.report_template_id ?? null,
    moduleKey: req.body.module_key,
    format,
    filters: req.body.filters,
    rowCount,
    fileName,
    exportedBy: user.id,
  });

  if (req.body.report_template_id) {
    await reportService.recordTemplateUsage(Number(req.body.report_template_id));
  }

  await logAudit({ req, module: "report_export", action: "EXPORT", details: `${req.body.module_key} (${format}), ${rowCount} rows` });

  res.setHeader(
    "Content-Type",
    format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(body);
});

// ─── REPORT TEMPLATES (saved reports) ──────────────────────────────────────────
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const result = await reportService.createTemplate(req.body, user.id);
  await logAudit({ req, module: "report_template", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Report template saved"));
});

export const editTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const oldData = await reportService.getTemplateById(req.params.id as string);
  const result = await reportService.editTemplate(req.params.id as string, req.body, user);
  await logAudit({ req, module: "report_template", recordId: req.params.id, action: "UPDATE", oldData, newData: req.body });
  res.send(createResponse(result, "Report template updated"));
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const oldData = await reportService.getTemplateById(req.params.id as string);
  const result = await reportService.deleteTemplate(req.params.id as string, user);
  await logAudit({ req, module: "report_template", recordId: req.params.id, action: "DELETE", oldData });
  res.send(createResponse(result, "Report template deleted"));
});

export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getTemplateById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Report template not found"));
    return;
  }
  res.send(createResponse(result));
});

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const moduleKey = req.query.module_key ? String(req.query.module_key) : undefined;
  const result = await reportService.listTemplates(user, moduleKey);
  res.send(createResponse(result));
});

// ─── DASHBOARD ──────────────────────────────────────────────────────────────────
export const getReportDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getReportDashboardMetrics();
  res.send(createResponse(result));
});

// ─── EXPORT HISTORY ─────────────────────────────────────────────────────────────
export const getExportHistory = asyncHandler(async (req: Request, res: Response) => {
  const moduleKey = req.query.module_key ? String(req.query.module_key) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const result = await reportService.getExportHistory({ module_key: moduleKey, limit, offset });
  res.send(createResponse(result));
});
