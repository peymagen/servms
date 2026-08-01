import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as penaltyController from "./penalty.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission, requireAnyRole } from "../../common/middleware/permission.middleware";
import { documentUpload } from "../../common/middleware/multer.middleware";
import {
  createPenaltyValidation,
  updatePenaltyValidation,
  revokePenaltyValidation,
  updateRecoveryValidation,
} from "./penalty.validation";

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

// Secure all penalty endpoints
router.use(roleAuth());

router.get("/metrics", requirePermission("penalty_management", "view"), penaltyController.getPenaltyMetrics);
router.get(
  "/notifications",
  requirePermission("penalty_management", "view"),
  penaltyController.getPenaltyNotifications
);
router.get("/", requirePermission("penalty_management", "view"), penaltyController.getPenalties);
router.get("/:id", requirePermission("penalty_management", "view"), penaltyController.getPenaltyById);

router.post(
  "/",
  requirePermission("penalty_management", "create"),
  createPenaltyValidation,
  validate,
  penaltyController.createPenalty
);
router.patch(
  "/:id",
  requirePermission("penalty_management", "edit"),
  updatePenaltyValidation,
  validate,
  penaltyController.editPenalty
);

// ─── Approval workflow (Divisional/HQ Admin only, via can_approve_reject) ────────
router.post(
  "/:id/approve",
  requirePermission("penalty_management", "approve_reject"),
  penaltyController.approvePenalty
);
router.post(
  "/:id/reject",
  requirePermission("penalty_management", "approve_reject"),
  penaltyController.rejectPenalty
);
router.post(
  "/:id/revoke",
  requirePermission("penalty_management", "approve_reject"),
  revokePenaltyValidation,
  validate,
  penaltyController.revokePenalty
);

// ─── Recovery workflow ────────────────────────────────────────────────────────────
// requireAnyRole, not requirePermission("penalty_management","edit") — Dealing
// Section's role_permissions row no longer grants can_edit at all (migration
// 011), since that flag also gated the general PATCH /:id and POST
// /:id/documents routes below, not just recovery entry. This is the one
// penalty route Dealing Section can still reach.
router.patch(
  "/:id/recovery",
  requireAnyRole(["hq_admin", "divisional_admin", "dealing_section"]),
  updateRecoveryValidation,
  validate,
  penaltyController.updateRecovery
);

// ─── Supporting documents ─────────────────────────────────────────────────────────
router.post(
  "/:id/documents",
  requirePermission("penalty_management", "edit"),
  documentUpload.single("document"),
  penaltyController.uploadPenaltyDocument
);

export default router;
