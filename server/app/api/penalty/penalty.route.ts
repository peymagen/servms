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
  approvePenaltyValidation,
  updateRecoveryValidation,
  verifyRecoveryValidation,
  uploadPenaltyDocumentValidation,
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
  approvePenaltyValidation,
  validate,
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
// Recovery entry is Dealing-Section-exclusive per spec ("Recovery entry shall be
// managed by Dealing Section") — hq_admin/divisional_admin no longer share this
// route; their oversight role is the separate verify step below instead.
router.patch(
  "/:id/recovery",
  requireAnyRole(["dealing_section"]),
  updateRecoveryValidation,
  validate,
  penaltyController.updateRecovery
);

// Document Verification step: Admin/Divisional Admin verifies (or rejects) a
// Dealing-Section recovery entry before it can reach recovery_status "closed".
router.post(
  "/:id/recovery/verify",
  requirePermission("penalty_management", "approve_reject"),
  verifyRecoveryValidation,
  validate,
  penaltyController.verifyRecovery
);

// ─── Supporting documents ─────────────────────────────────────────────────────────
// requireAnyRole, not requirePermission("penalty_management","edit") — Dealing
// Section's role_permissions row grants no can_edit at all (see recovery route
// above), but still needs to upload recovery-proof documents; hq_admin/
// divisional_admin upload penalty-order/approval documents through the same route.
router.post(
  "/:id/documents",
  requireAnyRole(["hq_admin", "divisional_admin", "dealing_section"]),
  documentUpload.single("document"),
  uploadPenaltyDocumentValidation,
  validate,
  penaltyController.uploadPenaltyDocument
);

export default router;
