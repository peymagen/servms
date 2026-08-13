import * as transferService from "./user.transfer-request.service";
import { createResponse } from "../../common/helper/response.hepler";
import { logAudit } from "../../common/services/auditLog.service";
import { assertCanManageAdminTier } from "../../common/constants/roles";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

export const raiseTransferRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  const userId = Number(req.body.user_id);
  const result = await transferService.raiseTransferRequest(userId, actingUser.id, {
    to_division_id: req.body.to_division_id ? Number(req.body.to_division_id) : undefined,
    to_role_id: req.body.to_role_id ? Number(req.body.to_role_id) : undefined,
    reason: req.body.reason,
  });
  await logAudit({
    req,
    module: "user_management",
    recordId: result.id,
    action: "CREATE",
    newData: req.body,
    details: "User transfer request raised",
  });
  res.send(createResponse(result, "Transfer request submitted"));
});

export const getTransferRequests = asyncHandler(async (req: Request, res: Response) => {
  const result = await transferService.getTransferRequests(req.query.approval_status as string | undefined);
  res.send(createResponse(result));
});

export const approveTransferRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  const request = await transferService.getTransferRequestById(req.params.id as string);
  if (!request) {
    res.status(404).send(createResponse(null, "Transfer request not found"));
    return;
  }
  // If either the user's current or requested role sits in the Admin tier,
  // only Super Admin HQ may approve — same delegation rule as direct user edits.
  assertCanManageAdminTier(actingUser, request.from_role_name, request.to_role_name);

  const result = await transferService.approveTransferRequest(req.params.id as string, actingUser.id, req.body?.remarks);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "APPROVE",
    details: "Transfer request approved",
  });
  res.send(createResponse(result, "Transfer request approved — user division/role updated"));
});

export const rejectTransferRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  const result = await transferService.rejectTransferRequest(req.params.id as string, actingUser.id, req.body?.remarks);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "REJECT",
    details: req.body?.remarks,
  });
  res.send(createResponse(result, "Transfer request rejected"));
});
