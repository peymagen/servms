import * as dashboardService from "./dashboard.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let userDivisionId: number | undefined = undefined;

  // If role_name is 'admin' (Divisional Admin), restrict metrics to their division
  if (user && user.role_name === "admin" && user.division_id) {
    userDivisionId = Number(user.division_id);
  }

  const result = await dashboardService.getDashboardStats(userDivisionId);
  res.send(createResponse(result));
});
