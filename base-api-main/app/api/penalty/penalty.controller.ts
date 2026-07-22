import * as penaltyService from "./penalty.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── LOG PENALTY ───────────────────────────────────────────────────────────────
export const createPenalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;
  const result = await penaltyService.createPenalty(req.body, userId);
  res.send(createResponse(result, "Penalty imposed successfully"));
});

// ─── GET PENALTIES (WITH ROLE DIVISION RESTRICTION) ─────────────────────────────
export const getPenalties = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const contractor_id = req.query.contractor_id ? Number(req.query.contractor_id) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await penaltyService.getPenalties({
    limit,
    offset,
    search,
    division_id,
    contractor_id,
    status
  });

  res.send(createResponse(result));
});

// ─── GET PENALTY BY ID ───────────────────────────────────────────────────────────
export const getPenaltyById = asyncHandler(async (req: Request, res: Response) => {
  const result = await penaltyService.getPenaltyById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "Penalty record not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── UPDATE PENALTY STATUS (PATCH) ───────────────────────────────────────────────
export const editPenalty = asyncHandler(async (req: Request, res: Response) => {
  const result = await penaltyService.editPenalty(req.params.id, req.body);
  res.send(createResponse(result, "Penalty updated successfully"));
});

// ─── GET PENALTY METRICS ────────────────────────────────────────────────────────
export const getPenaltyMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;

  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await penaltyService.getPenaltyMetrics(division_id);
  res.send(createResponse(result));
});
