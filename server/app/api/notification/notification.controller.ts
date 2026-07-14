import * as notificationService from "./notification.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { type NotificationModule } from "./notification.service";

const VALID_MODULES: NotificationModule[] = ["vendor_master", "complaints", "penalties", "user_management"];

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let divisionId: number | undefined = undefined;
  if (user?.role_name === "admin" && user.division_id) {
    divisionId = Number(user.division_id);
  }

  const moduleParam = req.query.module ? String(req.query.module) : "all";
  const module = VALID_MODULES.includes(moduleParam as NotificationModule)
    ? (moduleParam as NotificationModule)
    : "all";
  const limit = req.query.limit ? Number(req.query.limit) : 6;

  const result = await notificationService.getNotifications({ divisionId, module, limit });
  res.send(createResponse(result));
});
