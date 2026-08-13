import * as penaltyService from "./penalty.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped, assertRecordAccessible } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";
import { type PenaltyApprovalStatus, type PenaltyRecoveryStatus } from "./penalty.dto";

// ─── LOG PENALTY ───────────────────────────────────────────────────────────────
export const createPenalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;
  const result = await penaltyService.createPenalty(req.body, userId);
  await logAudit({ req, module: "penalty", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Penalty imposed successfully"));
});

// ─── GET PENALTIES (WITH ROLE DIVISION RESTRICTION) ─────────────────────────────
export const getPenalties = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await penaltyService.getPenalties({
    limit,
    offset,
    division_id,
    search: req.query.search ? String(req.query.search) : undefined,
    contractor_id: req.query.contractor_id ? Number(req.query.contractor_id) : undefined,
    vendor_id: req.query.vendor_id ? Number(req.query.vendor_id) : undefined,
    approval_status: req.query.approval_status as PenaltyApprovalStatus | undefined,
    recovery_status: req.query.recovery_status as PenaltyRecoveryStatus | undefined,
    penalty_date_from: req.query.penalty_date_from ? String(req.query.penalty_date_from) : undefined,
    penalty_date_to: req.query.penalty_date_to ? String(req.query.penalty_date_to) : undefined,
    due_date_from: req.query.due_date_from ? String(req.query.due_date_from) : undefined,
    due_date_to: req.query.due_date_to ? String(req.query.due_date_to) : undefined,
  });

  res.send(createResponse(result));
});

// ─── GET PENALTY BY ID ───────────────────────────────────────────────────────────
export const getPenaltyById = asyncHandler(async (req: Request, res: Response) => {
  const result = await penaltyService.getPenaltyById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Penalty record not found"));
    return;
  }
  assertRecordAccessible(req.user as any, result);
  res.send(createResponse(result));
});

// ─── UPDATE PENALTY (basic fields) ───────────────────────────────────────────────
export const editPenalty = asyncHandler(async (req: Request, res: Response) => {
  const oldData = await penaltyService.getPenaltyById(req.params.id as string);
  const result = await penaltyService.editPenalty(req.params.id as string, req.body);
  await logAudit({
    req,
    module: "penalty",
    recordId: req.params.id,
    action: "UPDATE",
    oldData,
    newData: req.body,
  });
  res.send(createResponse(result, "Penalty updated successfully"));
});

// ─── APPROVE / REJECT / REVOKE (Divisional/HQ Admin only) ───────────────────────
export const approvePenalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await penaltyService.approvePenalty(req.params.id as string, userId, req.body);
  await logAudit({ req, module: "penalty", recordId: req.params.id, action: "APPROVE", newData: req.body });
  res.send(createResponse(result, "Penalty approved"));
});

export const rejectPenalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await penaltyService.rejectPenalty(req.params.id as string, userId, req.body?.reason);
  await logAudit({
    req,
    module: "penalty",
    recordId: req.params.id,
    action: "REJECT",
    details: req.body?.reason,
  });
  res.send(createResponse(result, "Penalty rejected"));
});

export const revokePenalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  if (!req.body?.reason) {
    res.status(400).send(createResponse(null, "A revocation reason is required"));
    return;
  }
  const result = await penaltyService.revokePenalty(req.params.id as string, userId, req.body.reason);
  await logAudit({
    req,
    module: "penalty",
    recordId: req.params.id,
    action: "REVOKE",
    details: req.body.reason,
  });
  res.send(createResponse(result, "Penalty revoked"));
});

// ─── RECOVERY WORKFLOW ────────────────────────────────────────────────────────────
export const updateRecovery = asyncHandler(async (req: Request, res: Response) => {
  const oldData = (await penaltyService.getPenaltyById(req.params.id as string)) as any;
  const result = await penaltyService.updateRecovery(req.params.id as string, req.body);
  await logAudit({
    req,
    module: "penalty",
    recordId: req.params.id,
    action: "RECOVER",
    oldData: { recovery_status: oldData?.recovery_status, recovery_amount: oldData?.recovery_amount },
    newData: req.body,
  });
  res.send(createResponse(result, "Recovery status updated"));
});

// ─── RECOVERY DOCUMENT VERIFICATION (Admin/Divisional Admin) ────────────────────
export const verifyRecovery = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const oldData = (await penaltyService.getPenaltyById(req.params.id as string)) as any;
  const result = await penaltyService.verifyRecovery(req.params.id as string, userId, req.body);
  await logAudit({
    req,
    module: "penalty",
    recordId: req.params.id,
    action: "UPDATE",
    oldData: { recovery_verification_status: oldData?.recovery_verification_status },
    newData: req.body,
    details: `Recovery ${req.body?.decision}`,
  });
  res.send(createResponse(result, `Recovery ${req.body?.decision}`));
});

// ─── SUPPORTING DOCUMENTS ────────────────────────────────────────────────────────
export const uploadPenaltyDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).send(createResponse(null, "A document file is required"));
    return;
  }
  const userId = (req.user as any)?.id;
  const documentPath = `/uploads/${req.file.filename}`;
  const documentType = (req.body?.document_type as any) ?? "other";
  const result = await penaltyService.uploadPenaltyDocument(
    req.params.id as string,
    documentType,
    documentPath,
    req.file.originalname,
    userId
  );
  await logAudit({ req, module: "penalty", recordId: req.params.id, action: "UPDATE", details: `Document uploaded (${documentType})` });
  res.send(createResponse(result, "Document uploaded successfully"));
});

// ─── GET PENALTY METRICS ────────────────────────────────────────────────────────
export const getPenaltyMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;

  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await penaltyService.getPenaltyMetrics(division_id);
  res.send(createResponse(result));
});

// ─── NOTIFICATION FEED (upcoming due / overdue / recovered) ─────────────────────
export const getPenaltyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }
  const result = await penaltyService.getPenaltyNotificationRows(division_id);
  res.send(createResponse(result));
});
