import * as dropdownService from "../dropdown/dropdown.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

// Inspection Category / Type are the "inspection_category" / "inspection_type"
// categories of the generic dropdown_options table (parent_id links a type to
// its category) — same consolidation as Complaint Type/Sub-type. These
// endpoints wrap the dropdown CRUD so Admin/HQ Admin/Sub-admin manage them
// without needing admin_module access to every other dropdown category.

export const getInspectionCategories = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
  const includeInactive = req.query.include_inactive === "1";
  const result = await dropdownService.getDropdownOptions("inspection_category", divisionId, undefined, includeInactive);
  res.send(createResponse(result));
});

export const getInspectionTypes = asyncHandler(async (req: Request, res: Response) => {
  const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
  const categoryId = req.query.category_id ? Number(req.query.category_id) : undefined;
  const includeInactive = req.query.include_inactive === "1";
  if (!categoryId) {
    res.status(400).send(createResponse(null, "category_id query param is required"));
    return;
  }
  const result = await dropdownService.getDropdownOptions("inspection_type", divisionId, categoryId, includeInactive);
  res.send(createResponse(result));
});

export const createInspectionCategory = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await dropdownService.createDropdownOption({ ...req.body, category: "inspection_category", parent_id: null }, userId);
  await logAudit({ req, module: "inspection_type_master", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Inspection Category created successfully"));
});

export const createInspectionType = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  if (!req.body.parent_id) {
    res.status(400).send(createResponse(null, "parent_id (Inspection Category) is required"));
    return;
  }
  const result = await dropdownService.createDropdownOption({ ...req.body, category: "inspection_type" }, userId);
  await logAudit({ req, module: "inspection_type_master", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Inspection Type created successfully"));
});

export const editInspectionTypeOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.editDropdownOption(req.params.id as string, req.body);
  await logAudit({ req, module: "inspection_type_master", recordId: req.params.id, action: "UPDATE", newData: req.body });
  res.send(createResponse(result, "Updated successfully"));
});

export const deleteInspectionTypeOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.deleteDropdownOption(req.params.id as string);
  await logAudit({ req, module: "inspection_type_master", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(result, "Deactivated successfully"));
});

export const activateInspectionTypeOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.activateDropdownOption(req.params.id as string);
  await logAudit({ req, module: "inspection_type_master", recordId: req.params.id, action: "STATUS_CHANGE", details: "Activated" });
  res.send(createResponse(result, "Activated successfully"));
});
