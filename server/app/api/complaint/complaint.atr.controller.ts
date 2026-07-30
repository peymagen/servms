import * as atrService from "./complaint.atr.service";
import * as complaintService from "./complaint.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit, type AuditAction } from "../../common/services/auditLog.service";

// ─── DEALING SECTION: submit ATR (with optional document uploads) ─────────────
export const submitAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await atrService.submitAtr(req.params.id as string, req.body.remarks, userId);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await complaintService.addDocuments(Number(req.params.id), files, userId, "atr", result.id);
  }

  await logAudit({ req, module: "complaint_atr", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Action Taken Report submitted"));
});

// ─── DEALING SECTION: edit ATR while still pending review ─────────────────────
export const editAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await atrService.editAtr(req.params.atrId as string, req.body.remarks, userId);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await complaintService.addDocuments(Number(req.params.id), files, userId, "atr", Number(req.params.atrId));
  }

  await logAudit({ req, module: "complaint_atr", recordId: req.params.atrId, action: "UPDATE", newData: req.body });
  res.send(createResponse(result, "Action Taken Report updated"));
});

// ─── SUB-ADMIN: review ATR, forward to Admin ───────────────────────────────────
export const reviewAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await atrService.reviewAtr(req.params.id as string, req.params.atrId as string, req.body.remarks, userId);
  await logAudit({ req, module: "complaint_atr", recordId: req.params.atrId, action: "STATUS_CHANGE", newData: req.body, details: "Sub-admin review" });
  res.send(createResponse(result, "Action Taken Report reviewed and forwarded to Admin"));
});

// ─── ADMIN: accept / reject / send back ────────────────────────────────────────
export const decideAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const decision = req.body.decision as "accepted" | "rejected" | "sent_back";
  if (!["accepted", "rejected", "sent_back"].includes(decision)) {
    res.status(400).send(createResponse(null, "decision must be accepted, rejected, or sent_back"));
    return;
  }
  const result = await atrService.decideAtr(req.params.id as string, req.params.atrId as string, decision, req.body.remarks, userId);
  const action: AuditAction = decision === "accepted" ? "APPROVE" : decision === "rejected" ? "REJECT" : "STATUS_CHANGE";
  await logAudit({ req, module: "complaint_atr", recordId: req.params.atrId, action, newData: req.body });
  res.send(createResponse(result, `Action Taken Report ${decision.replace("_", " ")}`));
});

export const getAtrsForComplaint = asyncHandler(async (req: Request, res: Response) => {
  const result = await atrService.getAtrsForComplaint(req.params.id as string);
  res.send(createResponse(result));
});
