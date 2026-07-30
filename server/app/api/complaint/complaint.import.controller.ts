import * as importService from "./complaint.import.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

// ─── IMPORT RAILMADAD COMPLAINTS FROM EXCEL ────────────────────────────────────
export const importRailMadad = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).send(createResponse(null, "An Excel file is required"));
    return;
  }
  const userId = (req.user as any)?.id;
  const summary = await importService.importRailMadadComplaints(req.file.path, req.file.originalname, userId);

  await logAudit({
    req,
    module: "complaint_import",
    recordId: summary.importId,
    action: "IMPORT",
    newData: { fileName: req.file.originalname, ...summary },
  });

  res.send(
    createResponse(
      summary,
      `Imported ${summary.importedCount} of ${summary.totalRecords} records (${summary.duplicateCount} duplicate, ${summary.failedCount} failed)`
    )
  );
});

export const getImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const result = await importService.getImportHistory(limit);
  res.send(createResponse(result));
});
