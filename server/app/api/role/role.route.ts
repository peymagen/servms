import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as roleController from "./role.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import {
  createRoleValidation,
  updateRoleValidation,
  updatePermissionsValidation,
} from "./role.validation";

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

// Only Super Admin should manage roles — enforced here since this touches system-wide access control
router.use(roleAuth());

router.get("/", roleController.getRoles);
router.get("/:id", roleController.getRoleById);
router.get("/:id/permissions", roleController.getRolePermissions);

router.post("/", createRoleValidation, validate, roleController.createRole);
router.patch("/:id", updateRoleValidation, validate, roleController.editRole);
router.patch(
  "/:id/permissions",
  updatePermissionsValidation,
  validate,
  roleController.updateRolePermissions
);
router.delete("/:id", roleController.deleteRole);

export default router;
