import * as idcardService from "./idcard.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";
import { type CardExpirySource, type CardTemplate } from "./idcard.dto";

// ─── GET ID CARDS ───────────────────────────────────────────────────────────────
export const getIdCards = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const approval_status = req.query.approval_status ? String(req.query.approval_status) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await idcardService.getIdCards({ limit, offset, search, division_id, approval_status });
  res.send(createResponse(result));
});

// ─── ISSUE REQUEST ───────────────────────────────────────────────────────────────
export const requestIdCard = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await idcardService.requestIdCard(
    req.params.vendorId as string,
    { template: req.body.template as CardTemplate, expiry_source: req.body.expiry_source as CardExpirySource },
    userId
  );
  await logAudit({ req, module: "idcard", recordId: req.params.vendorId, action: "ISSUE", newData: req.body, details: "Issue requested" });
  res.send(createResponse(result, "ID card issue request submitted"));
});

// ─── SUB ADMIN APPROVAL (auto digital signature + QR + PDF) ─────────────────────
export const approveIdCard = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const actorDivisionId = isDivisionScoped(user?.role_name) ? user.division_id : undefined;
  const result = await idcardService.approveIdCard(req.params.vendorId as string, user?.id, actorDivisionId, user?.role_name);
  await logAudit({ req, module: "idcard", recordId: req.params.vendorId, action: "APPROVE", details: "Card approved and signed" });
  res.send(createResponse(result, "ID card approved, signed, and generated"));
});

export const rejectIdCard = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const actorDivisionId = isDivisionScoped(user?.role_name) ? user.division_id : undefined;
  const result = await idcardService.rejectIdCard(req.params.vendorId as string, user?.id, req.body.reason, actorDivisionId);
  await logAudit({ req, module: "idcard", recordId: req.params.vendorId, action: "REJECT", details: req.body.reason });
  res.send(createResponse(result, "ID card request rejected"));
});

// ─── DOWNLOAD PDF ────────────────────────────────────────────────────────────────
export const downloadIdCardPdf = asyncHandler(async (req: Request, res: Response) => {
  const templateParam = req.query.template;
  if (templateParam !== undefined && templateParam !== "template_a" && templateParam !== "template_b") {
    res.status(400).send(createResponse(null, "Invalid template"));
    return;
  }

  const result = await idcardService.getIdCardPdf(req.params.vendorId as string, templateParam as CardTemplate | undefined);
  if (!result) {
    res.status(404).send(createResponse(null, "No generated ID card PDF found for this vendor"));
    return;
  }
  await logAudit({ req, module: "idcard", recordId: req.params.vendorId, action: "DOWNLOAD", details: templateParam });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.send(Buffer.from(result.bytes));
});

// ─── PUBLIC QR VERIFICATION ─────────────────────────────────────────────────────
export const verifyIdCard = asyncHandler(async (req: Request, res: Response) => {
  const result = await idcardService.verifyIdCard(req.params.code as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Invalid or unrecognized ID card / QR code"));
    return;
  }
  res.send(createResponse(result));
});
