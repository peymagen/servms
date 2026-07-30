import * as importService from "./report.import.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

export const getImportableMasters = asyncHandler(async (req: Request, res: Response) => {
  res.send(createResponse(importService.listImportableMasters()));
});

export const downloadMasterTemplate = asyncHandler(async (req: Request, res: Response) => {
  const buffer = importService.buildMasterTemplate(req.params.masterKey as string);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.masterKey}-import-template.xlsx"`);
  res.send(buffer);
});

export const importMasterData = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).send(createResponse(null, "An Excel file is required"));
    return;
  }
  const userId = (req.user as any)?.id;
  const summary = await importService.importMasterData(req.params.masterKey as string, req.file.path, req.file.originalname, userId);

  await logAudit({
    req,
    module: "report_import",
    recordId: summary.importId,
    action: "IMPORT",
    newData: { masterKey: req.params.masterKey, fileName: req.file.originalname, ...summary },
  });

  res.send(
    createResponse(
      summary,
      `Imported ${summary.importedCount} of ${summary.totalRecords} records (${summary.duplicateCount} duplicate, ${summary.failedCount} failed)`
    )
  );
});

export const getImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const masterKey = req.query.master_key ? String(req.query.master_key) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const result = await importService.getImportHistory(masterKey, limit);
  res.send(createResponse(result));
});
