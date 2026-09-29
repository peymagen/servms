import * as transferService from "./user.transfer-request.service";
import { createResponse } from "../../common/helper/response.hepler";
import { logAudit } from "../../common/services/auditLog.service";
import * as userService from "./user.service";
import { assertCanManageAdminTier, assertOwnDivisionRecord, isDivisionScoped } from "../../common/constants/roles";
import createHttpError from "http-errors";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

export const raiseTransferRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  const userId = Number(req.body.user_id);
  // Division-scoped roles may only raise transfers for their own division's users.
  assertOwnDivisionRecord(actingUser, (await userService.getUserById(String(userId))) as any);
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
  const user = req.user as any;
  const divisionId = isDivisionScoped(user?.role_name) ? user.division_id : undefined;
  const result = await transferService.getTransferRequests(req.query.approval_status as string | undefined, divisionId);
  res.send(createResponse(result));
});

// "Transfer Request Raised → HQ Admin Review → Approval": a transfer moves a user
// between divisions, so only HQ-level roles decide it, never a division-scoped one.
const assertHqReviewer = (actingUser: any): void => {
  if (isDivisionScoped(actingUser?.role_name)) {
    throw createHttpError(403, "Transfer requests are reviewed by HQ");
  }
};

export const approveTransferRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  assertHqReviewer(actingUser);
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
  assertHqReviewer(actingUser);
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
