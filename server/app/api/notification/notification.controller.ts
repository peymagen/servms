import * as notificationService from "./notification.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { type NotificationModule } from "./notification.service";
import { isDivisionScoped, isSelfScoped, isAssigneeScoped } from "../../common/constants/roles";

// Was missing "inspections" — NotificationModule (notification.service.ts) has
// included it since the Inspection module shipped, but this list wasn't updated
// alongside it, silently dropping any ?module=inspections request to "all".
const VALID_MODULES: NotificationModule[] = ["vendor_master", "complaints", "penalties", "user_management", "inspections"];

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let divisionId: number | undefined = undefined;
  if (isDivisionScoped(user?.role_name) && user.division_id) {
    divisionId = Number(user.division_id);
  }

  // Inspector/Dealing Section get every division's feed today with no
  // ownership narrowing at all — scope the Inspections feed to their own
  // (Inspector) or currently-assigned (Dealing Section) inspections, mirroring
  // the same scoping the Inspection module's own list endpoint already applies.
  let inspectorId: number | undefined;
  if (isSelfScoped(user?.role_name) && user?.id) {
    inspectorId = Number(user.id);
  }
  let assignedToUserId: number | undefined;
  if (isAssigneeScoped(user?.role_name) && user?.id) {
    assignedToUserId = Number(user.id);
  }

  const moduleParam = req.query.module ? String(req.query.module) : "all";
  const module = VALID_MODULES.includes(moduleParam as NotificationModule)
    ? (moduleParam as NotificationModule)
    : "all";
  const limit = req.query.limit ? Number(req.query.limit) : 6;

  const result = await notificationService.getNotifications({ divisionId, module, limit, inspectorId, assignedToUserId });
  res.send(createResponse(result));
});
