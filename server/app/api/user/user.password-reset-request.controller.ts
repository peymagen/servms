import * as prrService from "./user.password-reset-request.service";
import { createResponse } from "../../common/helper/response.hepler";
import * as userService from "./user.service";
import { logAudit } from "../../common/services/auditLog.service";
import { isDivisionScoped, assertOwnDivisionRecord, assertCanManageAdminTier } from "../../common/constants/roles";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// Any authenticated user may raise a request for themselves; raising one on
// behalf of someone else additionally requires user_management edit access
// (checked at the route level via requirePermission on that branch — see route).
export const raisePasswordResetRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  const requestedUserId = req.body.requested_user_id ? Number(req.body.requested_user_id) : actingUser.id;
  if (requestedUserId !== Number(actingUser.id)) {
    assertOwnDivisionRecord(actingUser, (await userService.getUserById(String(requestedUserId))) as any);
  }
  const result = await prrService.raisePasswordResetRequest(requestedUserId, actingUser.id, req.body.reason);
  await logAudit({
    req,
    module: "user_management",
    recordId: result.id,
    action: "CREATE",
    newData: { requested_user_id: requestedUserId, reason: req.body.reason },
    details: "Password reset request raised",
  });
  res.send(createResponse(result, "Password reset request submitted"));
});

export const getPasswordResetRequests = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const divisionId = isDivisionScoped(user?.role_name) ? user.division_id : undefined;
  const result = await prrService.getPasswordResetRequests(req.query.approval_status as string | undefined, divisionId);
  res.send(createResponse(result));
});

// A division-scoped approver may only decide requests for users in their own
// division, and never for Admin-tier accounts (approval issues a temp password).
const assertCanDecide = async (actingUser: any, requestId: string): Promise<void> => {
  const requestedUserId = await prrService.getRequestedUserId(requestId);
  if (requestedUserId == null) return;
  const target = await userService.getUserById(String(requestedUserId));
  assertOwnDivisionRecord(actingUser, target as any);
  assertCanManageAdminTier(actingUser, (target as any)?.role_name);
};

export const approvePasswordResetRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  await assertCanDecide(actingUser, req.params.id as string);
  const result = await prrService.approvePasswordResetRequest(req.params.id as string, actingUser.id, req.body?.remarks);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "APPROVE",
    details: "Password reset request approved",
  });
  res.send(createResponse(result, "Password reset approved — share the temporary password with the user securely"));
});

export const rejectPasswordResetRequest = asyncHandler(async (req: Request, res: Response) => {
  const actingUser = req.user as any;
  await assertCanDecide(actingUser, req.params.id as string);
  const result = await prrService.rejectPasswordResetRequest(req.params.id as string, actingUser.id, req.body?.remarks);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "REJECT",
    details: req.body?.remarks,
  });
  res.send(createResponse(result, "Password reset request rejected"));
});
