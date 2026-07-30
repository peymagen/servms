import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as contractorController from "./contractor.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import {
  createContractorValidation,
  updateContractorValidation,
  changeStatusValidation,
  assignUnitValidation,
} from "./contractor.validation";

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

// Secure all contractor endpoints
router.use(roleAuth());

router.get("/metrics", requirePermission("contractor_management", "view"), contractorController.getContractorMetrics);
router.get("/", requirePermission("contractor_management", "view"), contractorController.getContractors);
router.get("/:id", requirePermission("contractor_management", "view"), contractorController.getContractorById);

router.post(
  "/",
  requirePermission("contractor_management", "create"),
  upload.single("logo_image"),
  createContractorValidation,
  validate,
  contractorController.createContractor
);
router.patch(
  "/:id",
  requirePermission("contractor_management", "edit"),
  upload.single("logo_image"),
  updateContractorValidation,
  validate,
  contractorController.editContractor
);
router.delete("/:id", requirePermission("contractor_management", "delete"), contractorController.deleteContractor);

// ─── Status change (Divisional/HQ Admin only, via can_approve_reject) ────────────
router.post(
  "/:id/status",
  requirePermission("contractor_management", "approve_reject"),
  changeStatusValidation,
  validate,
  contractorController.changeContractorStatus
);

// ─── Unit linking ──────────────────────────────────────────────────────────────
router.get("/:id/units", requirePermission("contractor_management", "view"), contractorController.getContractorUnits);
router.post(
  "/:id/units",
  requirePermission("contractor_management", "edit"),
  assignUnitValidation,
  validate,
  contractorController.assignUnit
);
router.delete(
  "/:id/units/:unitId",
  requirePermission("contractor_management", "edit"),
  contractorController.unassignUnit
);

export default router;
