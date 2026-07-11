import * as renewalService from "./renewal.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

export const createRenewal = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  if (req.file) {
    req.body.medical_fitness_doc = `/uploads/${req.file.filename}`;
  }

  const result = await renewalService.createRenewal(req.body, userId);
  res.send(createResponse(result, "Renewal request submitted successfully"));
});

export const getRenewals = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const status = req.query.status ? String(req.query.status) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await renewalService.getRenewals({ limit, offset, division_id, status });
  res.send(createResponse(result));
});

export const getRenewalById = asyncHandler(async (req: Request, res: Response) => {
  const result = await renewalService.getRenewalById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "Renewal record not found"));
    return;
  }
  res.send(createResponse(result));
});

export const updateRenewalStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await renewalService.updateRenewalStatus(req.params.id, req.body.renewals_status);
  res.send(createResponse(result, "Renewal status updated successfully"));
});
