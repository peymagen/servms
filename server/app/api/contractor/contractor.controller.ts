import * as contractorService from "./contractor.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── CREATE CONTRACTOR ──────────────────────────────────────────────────────────
export const createContractor = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  if (req.file) {
    req.body.logo_image = `/uploads/${req.file.filename}`;
  }

  const result = await contractorService.createContractor(req.body, userId);
  res.send(createResponse(result, "Contractor onboarded successfully"));
});

// ─── GET CONTRACTORS ────────────────────────────────────────────────────────────
export const getContractors = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await contractorService.getContractors({
    limit,
    offset,
    search,
    division_id,
    status,
  });

  res.send(createResponse(result));
});

// ─── GET CONTRACTOR BY ID ────────────────────────────────────────────────────────
export const getContractorById = asyncHandler(async (req: Request, res: Response) => {
  const result = await contractorService.getContractorById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "Contractor not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── EDIT CONTRACTOR (PATCH) ─────────────────────────────────────────────────────
export const editContractor = asyncHandler(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.logo_image = `/uploads/${req.file.filename}`;
  }
  const result = await contractorService.editContractor(req.params.id, req.body);
  res.send(createResponse(result, "Contractor updated successfully"));
});

// ─── DELETE CONTRACTOR ───────────────────────────────────────────────────────────
export const deleteContractor = asyncHandler(async (req: Request, res: Response) => {
  const result = await contractorService.deleteContractor(req.params.id);
  res.send(createResponse(result, "Contractor deleted successfully"));
});

// ─── GET CONTRACTOR METRICS ─────────────────────────────────────────────────────
export const getContractorMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }
  const result = await contractorService.getContractorMetrics(division_id);
  res.send(createResponse(result));
});
