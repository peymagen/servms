import * as roleService from "./role.service";
import { createResponse } from "../../common/helper/response.hepler";
import { logAudit } from "../../common/services/auditLog.service";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

export const getRoles = asyncHandler(async (req: Request, res: Response) => {
  const result = await roleService.getRoles();
  res.send(createResponse(result));
});

export const getRoleById = asyncHandler(async (req: Request, res: Response) => {
  const result = await roleService.getRoleById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Role not found"));
    return;
  }
  res.send(createResponse(result));
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const result = await roleService.createRole(req.body);
  await logAudit({ req, module: "role_management", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Role created successfully"));
});

export const editRole = asyncHandler(async (req: Request, res: Response) => {
  const before = await roleService.getRoleById(req.params.id as string);
  const result = await roleService.editRole(req.params.id as string, req.body);
  await logAudit({ req, module: "role_management", recordId: req.params.id, action: "UPDATE", oldData: before, newData: req.body });
  res.send(createResponse(result, "Role updated successfully"));
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  const before = await roleService.getRoleById(req.params.id as string);
  const result = await roleService.deleteRole(req.params.id as string);
  await logAudit({ req, module: "role_management", recordId: req.params.id, action: "DELETE", oldData: before });
  res.send(createResponse(result, "Role deleted successfully"));
});

export const getRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const result = await roleService.getRolePermissions(req.params.id as string);
  res.send(createResponse(result));
});

export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const before = await roleService.getRolePermissions(req.params.id as string);
  const result = await roleService.updateRolePermissions(req.params.id as string, req.body.permissions);
  await logAudit({
    req,
    module: "role_management",
    recordId: req.params.id,
    action: "UPDATE",
    oldData: before,
    newData: req.body.permissions,
    details: "Permission matrix updated",
  });
  res.send(createResponse(result, "Permissions updated successfully"));
});
