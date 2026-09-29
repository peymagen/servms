import * as trainService from "./train.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped, assertRecordAccessible, pinToOwnDivision } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";
import createHttpError from "http-errors";

// Loads the train named by :id and applies the caller's division scope.
const loadAccessibleTrain = async (req: Request) => {
  const record = await trainService.getTrainById(req.params.id as string);
  if (!record) throw createHttpError(404, "Train not found");
  assertRecordAccessible(req.user as any, record);
  return record;
};

export const createTrain = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  pinToOwnDivision(req.user as any, req.body);
  const result = await trainService.createTrain(req.body, userId);
  await logAudit({ req, module: "train", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Train created successfully"));
});

export const getTrains = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }
  const result = await trainService.getTrains({
    limit: req.query.limit ? Number(req.query.limit) : 10,
    offset: req.query.offset ? Number(req.query.offset) : 0,
    search: req.query.search ? String(req.query.search) : undefined,
    division_id,
  });
  res.send(createResponse(result));
});

export const getTrainById = asyncHandler(async (req: Request, res: Response) => {
  const result = await loadAccessibleTrain(req);
  res.send(createResponse(result));
});

export const editTrain = asyncHandler(async (req: Request, res: Response) => {
  const oldData = await loadAccessibleTrain(req);
  pinToOwnDivision(req.user as any, req.body);
  const result = await trainService.editTrain(req.params.id as string, req.body);
  await logAudit({ req, module: "train", recordId: req.params.id, action: "UPDATE", oldData, newData: req.body });
  res.send(createResponse(result, "Train updated successfully"));
});

export const deleteTrain = asyncHandler(async (req: Request, res: Response) => {
  await loadAccessibleTrain(req);
  const result = await trainService.deleteTrain(req.params.id as string);
  await logAudit({ req, module: "train", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(result, "Train deactivated successfully"));
});
