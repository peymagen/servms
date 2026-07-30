import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import asyncHandler from "express-async-handler";
import * as roleController from "./role.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import {
  createRoleValidation,
  updateRoleValidation,
  updatePermissionsValidation,
} from "./role.validation";

// Every authenticated user needs to read their OWN role's permission matrix to render
// the UI (nav items, buttons, etc. all gate on it) — that must not require
// role_management/view, since most non-admin roles don't have that permission and would
// otherwise be unable to bootstrap their own permission set (empty sidebar for everyone
// but Role-Management admins). Viewing a DIFFERENT role's permissions still requires it.
const allowSelfOrRequireRoleView = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  if (user && String(user.role_id) === String(req.params.id)) {
    next();
    return;
  }
  requirePermission("role_management", "view")(req, res, next);
});

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.type === "field" ? e.path : "unknown",
        message: e.msg,
      })),
    });
    return;
  }
  next();
};

const router = Router();

// Role/permission management is itself gated by the role_management module
router.use(roleAuth());

router.get("/", requirePermission("role_management", "view"), roleController.getRoles);
router.get("/:id", requirePermission("role_management", "view"), roleController.getRoleById);
router.get("/:id/permissions", allowSelfOrRequireRoleView, roleController.getRolePermissions);

router.post("/", requirePermission("role_management", "create"), createRoleValidation, validate, roleController.createRole);
router.patch("/:id", requirePermission("role_management", "edit"), updateRoleValidation, validate, roleController.editRole);
router.patch(
  "/:id/permissions",
  requirePermission("role_management", "edit"),
  updatePermissionsValidation,
  validate,
  roleController.updateRolePermissions
);
router.delete("/:id", requirePermission("role_management", "delete"), roleController.deleteRole);

export default router;
