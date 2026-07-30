import * as dropdownService from "../dropdown/dropdown.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

// Complaint Type / Sub-type are just the "complaint_type" / "complaint_subtype"
// categories of the generic dropdown_options table (parent_id links a subtype
// to its type) — these endpoints are a thin, SRS-named wrapper around the
// existing dropdown CRUD so HQ Admin / Divisional Admin / Sub-admin manage
// them without needing admin_module access to every other dropdown category.

export const getComplaintTypes = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
  const includeInactive = req.query.include_inactive === "1";
  const result = await dropdownService.getDropdownOptions("complaint_type", divisionId, undefined, includeInactive);
  res.send(createResponse(result));
});

export const getComplaintSubtypes = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
  const typeId = req.query.type_id ? Number(req.query.type_id) : undefined;
  const includeInactive = req.query.include_inactive === "1";
  if (!typeId) {
    res.status(400).send(createResponse(null, "type_id query param is required"));
    return;
  }
  const result = await dropdownService.getDropdownOptions("complaint_subtype", divisionId, typeId, includeInactive);
  res.send(createResponse(result));
});

export const createComplaintType = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await dropdownService.createDropdownOption({ ...req.body, category: "complaint_type", parent_id: null }, userId);
  await logAudit({ req, module: "complaint_type_master", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Complaint Type created successfully"));
});

export const createComplaintSubtype = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  if (!req.body.parent_id) {
    res.status(400).send(createResponse(null, "parent_id (Complaint Type) is required"));
    return;
  }
  const result = await dropdownService.createDropdownOption({ ...req.body, category: "complaint_subtype" }, userId);
  await logAudit({ req, module: "complaint_type_master", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Complaint Sub-Type created successfully"));
});

export const editComplaintType = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.editDropdownOption(req.params.id as string, req.body);
  await logAudit({ req, module: "complaint_type_master", recordId: req.params.id, action: "UPDATE", newData: req.body });
  res.send(createResponse(result, "Updated successfully"));
});

export const deleteComplaintType = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.deleteDropdownOption(req.params.id as string);
  await logAudit({ req, module: "complaint_type_master", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(result, "Deactivated successfully"));
});

export const activateComplaintType = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.activateDropdownOption(req.params.id as string);
  await logAudit({ req, module: "complaint_type_master", recordId: req.params.id, action: "STATUS_CHANGE", details: "Activated" });
  res.send(createResponse(result, "Activated successfully"));
});
