import * as unitService from "./unit.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── CREATE UNIT ────────────────────────────────────────────────────────────────
export const createUnit = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  if (req.file) {
    req.body.sketch_map_file = `/uploads/${req.file.filename}`;
  }

  const result = await unitService.createUnit(req.body, userId);
  res.send(createResponse(result, "Unit saved successfully"));
});

// ─── GET UNITS ──────────────────────────────────────────────────────────────────
export const getUnits = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const station_id = req.query.station_id ? Number(req.query.station_id) : undefined;
  const contract_type = req.query.contract_type ? String(req.query.contract_type) : undefined;
  const cluster_name = req.query.cluster_name ? String(req.query.cluster_name) : undefined;
  const units_status = req.query.units_status ? String(req.query.units_status) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await unitService.getUnits({
    limit,
    offset,
    search,
    division_id,
    station_id,
    contract_type,
    cluster_name,
    units_status,
  });

  res.send(createResponse(result));
});

// ─── GET UNIT BY ID ──────────────────────────────────────────────────────────────
export const getUnitById = asyncHandler(async (req: Request, res: Response) => {
  const result = await unitService.getUnitById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "Unit not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── EDIT UNIT (PATCH) ───────────────────────────────────────────────────────────
export const editUnit = asyncHandler(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.sketch_map_file = `/uploads/${req.file.filename}`;
  }
  const result = await unitService.editUnit(req.params.id, req.body);
  res.send(createResponse(result, "Unit updated successfully"));
});

// ─── DELETE UNIT ─────────────────────────────────────────────────────────────────
export const deleteUnit = asyncHandler(async (req: Request, res: Response) => {
  const result = await unitService.deleteUnit(req.params.id);
  res.send(createResponse(result, "Unit deactivated successfully"));
});

// ─── GET UNIT METRICS ────────────────────────────────────────────────────────────
export const getUnitMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }
  const result = await unitService.getUnitMetrics(division_id);
  res.send(createResponse(result));
});
