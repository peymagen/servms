import * as complaintService from "./complaint.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── LOG COMPLAINT ─────────────────────────────────────────────────────────────
export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;
  const result = await complaintService.createComplaint(req.body, userId);
  res.send(createResponse(result, "Complaint logged successfully"));
});

// ─── GET COMPLAINTS (WITH ROLE DIVISION RESTRICTION) ────────────────────────────
export const getComplaints = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const unit_id = req.query.unit_id ? Number(req.query.unit_id) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await complaintService.getComplaints({
    limit,
    offset,
    search,
    division_id,
    unit_id,
    status
  });

  res.send(createResponse(result));
});

// ─── GET COMPLAINT BY ID ───────────────────────────────────────────────────────
export const getComplaintById = asyncHandler(async (req: Request, res: Response) => {
  const result = await complaintService.getComplaintById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "Complaint not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── UPDATE COMPLAINT (PATCH) ──────────────────────────────────────────────────
export const editComplaint = asyncHandler(async (req: Request, res: Response) => {
  const result = await complaintService.editComplaint(req.params.id, req.body);
  res.send(createResponse(result, "Complaint updated successfully"));
});

// ─── GET COMPLAINT METRICS ─────────────────────────────────────────────────────
export const getComplaintMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;

  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await complaintService.getComplaintMetrics(division_id);
  res.send(createResponse(result));
});
