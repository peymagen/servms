import * as dropdownService from "./dropdown.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

export const getDropdownOptions = asyncHandler(async (req: Request, res: Response) => {
  const category = String(req.query.category ?? "");
  if (!category) {
    res.status(400).send(createResponse(null, "category query param is required"));
    return;
  }
  const divisionId = req.query.division_id ? Number(req.query.division_id) : undefined;
  const parentId = req.query.parent_id ? Number(req.query.parent_id) : undefined;
  const result = await dropdownService.getDropdownOptions(category, divisionId, parentId);
  res.send(createResponse(result));
});

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.getCategories();
  res.send(createResponse(result));
});

export const createDropdownOption = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await dropdownService.createDropdownOption(req.body, userId);
  await logAudit({ req, module: "dropdown_options", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Dropdown option created successfully"));
});

export const editDropdownOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.editDropdownOption(req.params.id as string, req.body);
  await logAudit({ req, module: "dropdown_options", recordId: req.params.id, action: "UPDATE", newData: req.body });
  res.send(createResponse(result, "Dropdown option updated successfully"));
});

export const deleteDropdownOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.deleteDropdownOption(req.params.id as string);
  await logAudit({ req, module: "dropdown_options", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(result, "Dropdown option deactivated successfully"));
});

export const activateDropdownOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await dropdownService.activateDropdownOption(req.params.id as string);
  await logAudit({ req, module: "dropdown_options", recordId: req.params.id, action: "STATUS_CHANGE", details: "Activated" });
  res.send(createResponse(result, "Dropdown option activated successfully"));
});
