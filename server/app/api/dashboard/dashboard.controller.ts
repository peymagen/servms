import * as dashboardService from "./dashboard.service";
import { createResponse } from "../../common/helper/response.hepler";
import { isDivisionScoped } from "../../common/constants/roles";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let userDivisionId: number | undefined = undefined;

  // Division-scoped roles (Divisional Admin / Divisional Sub Admin) see only their own division
  if (user && isDivisionScoped(user.role_name) && user.division_id) {
    userDivisionId = Number(user.division_id);
  }

  const result = await dashboardService.getDashboardStats(userDivisionId);
  res.send(createResponse(result));
});
