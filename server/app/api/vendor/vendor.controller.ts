import * as vendorService from "./vendor.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── CREATE VENDOR ─────────────────────────────────────────────────────────────
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  // Handle uploaded profile image file if exists
  if (req.file) {
    req.body.profile_image = `/uploads/${req.file.filename}`;
  }

  // Handle document upload if passed (for medical fitness)
  if ((req as any).files && (req as any).files["medical_doc"]) {
    req.body.medical_fitness_doc = `/uploads/${(req as any).files["medical_doc"][0].filename}`;
  }

  const result = await vendorService.createVendor(req.body, userId);
  res.send(createResponse(result, "Vendor onboarded successfully"));
});

// ─── GET ALL VENDORS (WITH SEARCH, PAGINATION & ROLE RESTRICTION) ───────────────
export const getVendors = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  
  // Extract query parameters
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const aadhaar_status = req.query.aadhaar_status ? String(req.query.aadhaar_status) : undefined;
  const unit_id = req.query.unit_id ? Number(req.query.unit_id) : undefined;

  // Role restriction: Divisional admins can only access their own division's vendors
  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await vendorService.getVendors({
    limit,
    offset,
    search,
    division_id,
    unit_id,
    status,
    aadhaar_status
  });

  res.send(createResponse(result));
});

// ─── GET VENDOR BY ID ────────────────────────────────────────────────────────────
export const getVendorById = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.getVendorById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "Vendor not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── EDIT VENDOR (PATCH) ─────────────────────────────────────────────────────────
export const editVendor = asyncHandler(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.profile_image = `/uploads/${req.file.filename}`;
  }

  const result = await vendorService.editVendor(req.params.id, req.body);
  res.send(createResponse(result, "Vendor updated successfully"));
});

// ─── DELETE VENDOR ───────────────────────────────────────────────────────────────
export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.deleteVendor(req.params.id);
  res.send(createResponse(result, "Vendor deleted successfully"));
});

// ─── GET VENDOR METRICS ─────────────────────────────────────────────────────────
export const getVendorMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;

  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await vendorService.getVendorMetrics(division_id);
  res.send(createResponse(result));
});
