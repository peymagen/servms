import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as complaintController from "./complaint.controller";
import * as assignmentController from "./complaint.assignment.controller";
import * as atrController from "./complaint.atr.controller";
import * as importController from "./complaint.import.controller";
import * as exportController from "./complaint.export.controller";
import * as typeController from "./complaint.type.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission, requireAnyRole } from "../../common/middleware/permission.middleware";
import { upload, documentUpload } from "../../common/middleware/multer.middleware";
import { ROLE } from "../../common/constants/roles";
import {
  createComplaintValidation,
  updateComplaintValidation,
  assignComplaintValidation,
  submitAtrValidation,
  atrDecisionValidation,
} from "./complaint.validation";

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

// Complaint Type / Sub-type management is explicitly named in the SRS as
// HQ Admin / Divisional Admin / Sub-admin territory, independent of the
// generic admin_module permission matrix.
const canManageComplaintTypes = requireAnyRole([
  ROLE.HQ_ADMIN,
  ROLE.DIVISIONAL_ADMIN,
  ROLE.DEALING_SECTION,
  ROLE.HQ_SUB_ADMIN,
  ROLE.DIVISIONAL_SUB_ADMIN,
]);

const router = Router();
router.use(roleAuth());

// ─── Complaint Type / Sub-type master (must precede /:id) ──────────────────────
router.get("/types", typeController.getComplaintTypes);
router.get("/subtypes", typeController.getComplaintSubtypes);
router.post("/types", canManageComplaintTypes, typeController.createComplaintType);
router.patch("/types/:id", canManageComplaintTypes, typeController.editComplaintType);
router.delete("/types/:id", canManageComplaintTypes, typeController.deleteComplaintType);
router.post("/types/:id/activate", canManageComplaintTypes, typeController.activateComplaintType);
router.post("/subtypes", canManageComplaintTypes, typeController.createComplaintSubtype);
router.patch("/subtypes/:id", canManageComplaintTypes, typeController.editComplaintType);
router.delete("/subtypes/:id", canManageComplaintTypes, typeController.deleteComplaintType);
router.post("/subtypes/:id/activate", canManageComplaintTypes, typeController.activateComplaintType);

// ─── Dashboard / Reports (must precede /:id) ───────────────────────────────────
router.get("/metrics", requirePermission("complaint_management", "view"), complaintController.getComplaintMetrics);
router.get("/export", requirePermission("complaint_management", "export"), exportController.exportComplaints);

// ─── RailMadad Excel import (must precede /:id) ────────────────────────────────
router.post(
  "/import",
  requirePermission("complaint_management", "create"),
  upload.single("file"),
  importController.importRailMadad
);
router.get("/import/history", requirePermission("complaint_management", "view"), importController.getImportHistory);
// Admin-tier only — no role currently holds can_delete on complaint_management
// (nothing else in the module is deletable), so this narrow admin-only action is
// gated the same way as Complaint Type/Sub-type management above, not via the
// generic permission matrix.
router.delete(
  "/import/history/:id",
  requireAnyRole([ROLE.HQ_ADMIN, ROLE.DIVISIONAL_ADMIN, ROLE.DEALING_SECTION]),
  importController.deleteImportHistory
);

// ─── Core CRUD ──────────────────────────────────────────────────────────────────
router.get("/", requirePermission("complaint_management", "view"), complaintController.getComplaints);
router.get("/:id", requirePermission("complaint_management", "view"), complaintController.getComplaintById);
router.post(
  "/",
  requirePermission("complaint_management", "create"),
  documentUpload.array("evidence", 10),
  createComplaintValidation,
  validate,
  complaintController.createComplaint
);
router.patch(
  "/:id",
  requirePermission("complaint_management", "edit"),
  updateComplaintValidation,
  validate,
  complaintController.editComplaint
);

// ─── Assignment (assign / reassign / transfer) ─────────────────────────────────
router.get("/:id/assignments", requirePermission("complaint_management", "view"), assignmentController.getAssignmentHistory);
router.post(
  "/:id/assign",
  requirePermission("complaint_management", "edit"),
  assignComplaintValidation,
  validate,
  assignmentController.assignComplaint
);
router.post(
  "/:id/reassign",
  requirePermission("complaint_management", "edit"),
  assignComplaintValidation,
  validate,
  assignmentController.reassignComplaint
);
router.post(
  "/:id/transfer",
  requirePermission("complaint_management", "edit"),
  assignComplaintValidation,
  validate,
  assignmentController.transferComplaint
);

// ─── Action Taken Report workflow ───────────────────────────────────────────────
router.get("/:id/atr", requirePermission("complaint_management", "view"), atrController.getAtrsForComplaint);
router.post(
  "/:id/atr",
  requirePermission("complaint_management", "edit"),
  documentUpload.array("documents", 10),
  submitAtrValidation,
  validate,
  atrController.submitAtr
);
router.patch(
  "/:id/atr/:atrId",
  requirePermission("complaint_management", "edit"),
  documentUpload.array("documents", 10),
  atrController.editAtr
);
router.post(
  "/:id/atr/:atrId/review",
  requirePermission("complaint_management", "edit"),
  atrDecisionValidation,
  validate,
  atrController.reviewAtr
);
router.post(
  "/:id/atr/:atrId/decide",
  requirePermission("complaint_management", "approve_reject"),
  atrDecisionValidation,
  validate,
  atrController.decideAtr
);
router.post("/:id/close", requirePermission("complaint_management", "approve_reject"), complaintController.closeComplaint);

export default router;
