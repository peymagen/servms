import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as inspectionController from "./inspection.controller";
import * as assignmentController from "./inspection.assignment.controller";
import * as atrController from "./inspection.atr.controller";
import * as exportController from "./inspection.export.controller";
import * as typeController from "./inspection.type.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission, requireAnyRole } from "../../common/middleware/permission.middleware";
import { inspectionDocumentUpload } from "../../common/middleware/multer.middleware";
import { ROLE } from "../../common/constants/roles";
import {
  createInspectionValidation,
  updateInspectionValidation,
  assignInspectionValidation,
  submitAtrValidation,
  atrDecisionValidation,
} from "./inspection.validation";

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

// Inspection Category / Type management is HQ Admin / Divisional Admin /
// Sub-admin territory per the SRS, independent of the generic admin_module
// permission matrix — same pattern as Complaint Type/Sub-type.
const canManageInspectionTypes = requireAnyRole([
  ROLE.HQ_ADMIN,
  ROLE.DIVISIONAL_ADMIN,
  ROLE.HQ_SUB_ADMIN,
  ROLE.DIVISIONAL_SUB_ADMIN,
]);

const router = Router();
router.use(roleAuth());

// ─── Inspection Category / Type master (must precede /:id) ────────────────────
router.get("/categories", typeController.getInspectionCategories);
router.get("/types", typeController.getInspectionTypes);
router.post("/categories", canManageInspectionTypes, typeController.createInspectionCategory);
router.patch("/categories/:id", canManageInspectionTypes, typeController.editInspectionTypeOption);
router.delete("/categories/:id", canManageInspectionTypes, typeController.deleteInspectionTypeOption);
router.post("/categories/:id/activate", canManageInspectionTypes, typeController.activateInspectionTypeOption);
router.post("/types", canManageInspectionTypes, typeController.createInspectionType);
router.patch("/types/:id", canManageInspectionTypes, typeController.editInspectionTypeOption);
router.delete("/types/:id", canManageInspectionTypes, typeController.deleteInspectionTypeOption);
router.post("/types/:id/activate", canManageInspectionTypes, typeController.activateInspectionTypeOption);

// ─── Dashboard / Reports (must precede /:id) ───────────────────────────────────
router.get("/metrics", requirePermission("inspection_management", "view"), inspectionController.getInspectionMetrics);
router.get("/export", requirePermission("inspection_management", "export"), exportController.exportInspections);

// ─── Documents ──────────────────────────────────────────────────────────────────
router.delete("/documents/:documentId", requirePermission("inspection_management", "edit"), inspectionController.deleteDocument);

// ─── Core CRUD ──────────────────────────────────────────────────────────────────
router.get("/", requirePermission("inspection_management", "view"), inspectionController.getInspections);
router.get("/:id", requirePermission("inspection_management", "view"), inspectionController.getInspectionById);
router.post(
  "/",
  requirePermission("inspection_management", "create"),
  inspectionDocumentUpload.array("documents", 10),
  createInspectionValidation,
  validate,
  inspectionController.createInspection
);
router.patch(
  "/:id",
  requirePermission("inspection_management", "edit"),
  inspectionDocumentUpload.array("documents", 10),
  updateInspectionValidation,
  validate,
  inspectionController.editInspection
);
router.delete("/:id", requirePermission("inspection_management", "delete"), inspectionController.deleteInspection);

// ─── Workflow: submit / return ──────────────────────────────────────────────────
router.post("/:id/submit", requirePermission("inspection_management", "edit"), inspectionController.submitInspection);
router.post("/:id/return", requirePermission("inspection_management", "edit"), inspectionController.returnToInspector);
router.post("/:id/close", requirePermission("inspection_management", "approve_reject"), inspectionController.closeInspection);

// ─── Assignment (assign / reassign / transfer) ─────────────────────────────────
router.get("/:id/assignments", requirePermission("inspection_management", "view"), assignmentController.getAssignmentHistory);
router.post(
  "/:id/assign",
  requirePermission("inspection_management", "edit"),
  assignInspectionValidation,
  validate,
  assignmentController.assignInspection
);
router.post(
  "/:id/reassign",
  requirePermission("inspection_management", "edit"),
  assignInspectionValidation,
  validate,
  assignmentController.reassignInspection
);
router.post(
  "/:id/transfer",
  requirePermission("inspection_management", "edit"),
  assignInspectionValidation,
  validate,
  assignmentController.transferInspection
);

// ─── Action Taken Report workflow ───────────────────────────────────────────────
router.get("/:id/atr", requirePermission("inspection_management", "view"), atrController.getAtrsForInspection);
router.post(
  "/:id/atr",
  requirePermission("inspection_management", "edit"),
  inspectionDocumentUpload.array("documents", 10),
  submitAtrValidation,
  validate,
  atrController.createAtrDraft
);
router.patch(
  "/:id/atr/:atrId",
  requirePermission("inspection_management", "edit"),
  inspectionDocumentUpload.array("documents", 10),
  atrController.editAtr
);
router.post("/:id/atr/:atrId/submit", requirePermission("inspection_management", "edit"), atrController.submitAtr);
router.post(
  "/:id/atr/:atrId/review",
  requirePermission("inspection_management", "edit"),
  atrDecisionValidation,
  validate,
  atrController.reviewAtr
);
router.post(
  "/:id/atr/:atrId/decide",
  requirePermission("inspection_management", "approve_reject"),
  atrDecisionValidation,
  validate,
  atrController.decideAtr
);

export default router;
