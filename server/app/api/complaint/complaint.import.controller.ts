import * as importService from "./complaint.import.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";
import { isDivisionScoped } from "../../common/constants/roles";
import createHttpError from "http-errors";

// ─── IMPORT RAILMADAD COMPLAINTS FROM EXCEL ────────────────────────────────────
export const importRailMadad = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).send(createResponse(null, "An Excel file is required"));
    return;
  }
  const user = req.user as any;
  const userId = user?.id;
  const restrictDivisionId = isDivisionScoped(user?.role_name) ? user.division_id : null;
  const summary = await importService.importRailMadadComplaints(
    req.file.path,
    req.file.originalname,
    userId,
    restrictDivisionId
  );

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
  const user = req.user as any;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const divisionId = isDivisionScoped(user?.role_name) ? Number(user.division_id) : undefined;
  const result = await importService.getImportHistory(limit, divisionId);
  res.send(createResponse(result));
});

export const deleteImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  if (isDivisionScoped(user?.role_name)) {
    const divisionId = await importService.getImportHistoryDivisionId(req.params.id as string);
    if (divisionId == null || Number(divisionId) !== Number(user.division_id)) {
      throw createHttpError(404, "Import history record not found");
    }
  }
  await importService.deleteImportHistory(req.params.id as string);
  await logAudit({ req, module: "complaint_import", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(null, "Import history record deleted"));
});
