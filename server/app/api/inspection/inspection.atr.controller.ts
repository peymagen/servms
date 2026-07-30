import * as atrService from "./inspection.atr.service";
import * as inspectionService from "./inspection.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit, type AuditAction } from "../../common/services/auditLog.service";

// ─── DEALING SECTION: create a new ATR draft (with optional document uploads) ──
export const createAtrDraft = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await atrService.createAtrDraft(req.params.id as string, req.body, userId);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await inspectionService.addDocuments(Number(req.params.id), files, userId, "atr", result.id);
  }

  await logAudit({ req, module: "inspection_atr", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Action Taken Report draft saved"));
});

// ─── DEALING SECTION: edit ATR while Draft or Sent Back ────────────────────────
export const editAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await atrService.editAtr(req.params.atrId as string, req.body);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await inspectionService.addDocuments(Number(req.params.id), files, userId, "atr", Number(req.params.atrId));
  }

  await logAudit({ req, module: "inspection_atr", recordId: req.params.atrId, action: "UPDATE", newData: req.body });
  res.send(createResponse(result, "Action Taken Report updated"));
});

// ─── DEALING SECTION: submit a draft ATR for Sub-admin review ──────────────────
export const submitAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await atrService.submitAtr(req.params.id as string, req.params.atrId as string, userId);
  await logAudit({ req, module: "inspection_atr", recordId: req.params.atrId, action: "STATUS_CHANGE", details: "ATR submitted" });
  res.send(createResponse(result, "Action Taken Report submitted for review"));
});

// ─── SUB-ADMIN: forward to Admin, or send back to Dealing Section ──────────────
export const reviewAtr = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const decision = req.body.decision as "forward" | "send_back";
  if (!["forward", "send_back"].includes(decision)) {
    res.status(400).send(createResponse(null, "decision must be forward or send_back"));
    return;
  }
  const result = await atrService.reviewAtr(req.params.id as string, req.params.atrId as string, decision, req.body.remarks, userId);
  await logAudit({ req, module: "inspection_atr", recordId: req.params.atrId, action: "STATUS_CHANGE", newData: req.body, details: `Sub-admin review: ${decision}` });
  res.send(createResponse(result, decision === "forward" ? "Forwarded to Admin" : "Sent back to Dealing Section"));
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
  await logAudit({ req, module: "inspection_atr", recordId: req.params.atrId, action, newData: req.body });
  res.send(createResponse(result, `Action Taken Report ${decision.replace("_", " ")}`));
});

export const getAtrsForInspection = asyncHandler(async (req: Request, res: Response) => {
  const result = await atrService.getAtrsForInspection(req.params.id as string);
  res.send(createResponse(result));
});
