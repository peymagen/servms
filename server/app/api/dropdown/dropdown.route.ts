import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as dropdownController from "./dropdown.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { createDropdownValidation, updateDropdownValidation } from "./dropdown.validation";

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.type === "field" ? e.path : "unknown", message: e.msg })),
    });
    return;
  }
  next();
};

const router = Router();
router.use(roleAuth());

// Reading dropdown options is needed by every user filling out forms (e.g. Unit
// creation's Contract Category picker) — not gated behind admin_module permission.
router.get("/", dropdownController.getDropdownOptions);
router.get("/categories", dropdownController.getCategories);

// Managing the dropdown contents is Admin Module territory per UAT: "Divisional &
// HQ Admin & Sub-admin shall have the access to edit and update the contents of
// the dropdown in the Admin Module."
router.post(
  "/",
  requirePermission("admin_module", "create"),
  createDropdownValidation,
  validate,
  dropdownController.createDropdownOption
);
router.patch(
  "/:id",
  requirePermission("admin_module", "edit"),
  updateDropdownValidation,
  validate,
  dropdownController.editDropdownOption
);
router.delete("/:id", requirePermission("admin_module", "delete"), dropdownController.deleteDropdownOption);
router.post("/:id/activate", requirePermission("admin_module", "edit"), dropdownController.activateDropdownOption);

export default router;
