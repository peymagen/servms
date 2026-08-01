import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as vendorController from "./vendor.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { documentUpload } from "../../common/middleware/multer.middleware";
import {
  createVendorValidation,
  updateVendorValidation,
  changeStatusValidation,
  updateVerificationValidation,
  uploadDocumentValidation,
  transferUnitValidation,
  transferContractorValidation
} from "./vendor.validation";

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

// Secure all vendor endpoints
router.use(roleAuth());

router.get("/metrics", requirePermission("vendor_management", "view"), vendorController.getVendorMetrics);
router.get("/", requirePermission("vendor_management", "view"), vendorController.getVendors);
router.get("/:id", requirePermission("vendor_management", "view"), vendorController.getVendorById);

const vendorUpload = documentUpload.fields([
  { name: "profile_image", maxCount: 1 },
  { name: "signature", maxCount: 1 },
  { name: "aadhaar_document", maxCount: 1 },
  { name: "medical_verification_document", maxCount: 1 },
  { name: "police_verification_document", maxCount: 1 },
]);

router.post(
  "/",
  requirePermission("vendor_management", "create"),
  vendorUpload,
  createVendorValidation,
  validate,
  vendorController.createVendor
);
router.patch(
  "/:id",
  requirePermission("vendor_management", "edit"),
  vendorUpload,
  updateVendorValidation,
  validate,
  vendorController.editVendor
);
router.delete("/:id", requirePermission("vendor_management", "delete"), vendorController.deleteVendor);

// ─── Status change (Divisional/HQ Admin only, via can_approve_reject) ────────────
router.post(
  "/:id/status",
  requirePermission("vendor_management", "approve_reject"),
  changeStatusValidation,
  validate,
  vendorController.changeVendorStatus
);

// ─── Transfers ─────────────────────────────────────────────────────────────────────
router.post(
  "/:id/transfer-unit",
  requirePermission("vendor_management", "edit"),
  transferUnitValidation,
  validate,
  vendorController.transferUnit
);
router.post(
  "/:id/transfer-contractor",
  requirePermission("vendor_management", "edit"),
  transferContractorValidation,
  validate,
  vendorController.transferContractor
);

// ─── Verification ────────────────────────────────────────────────────────────────
router.get("/:id/verification", requirePermission("vendor_management", "view"), vendorController.getVendorVerification);
router.patch(
  "/:id/verification/police",
  requirePermission("vendor_management", "edit"),
  documentUpload.single("document"),
  updateVerificationValidation,
  validate,
  vendorController.updatePoliceVerification
);
router.patch(
  "/:id/verification/medical",
  requirePermission("vendor_management", "edit"),
  documentUpload.single("document"),
  updateVerificationValidation,
  validate,
  vendorController.updateMedicalVerification
);

// ─── Documents ────────────────────────────────────────────────────────────────────
router.get("/:id/documents", requirePermission("vendor_management", "view"), vendorController.getVendorDocuments);
router.post(
  "/:id/documents",
  requirePermission("vendor_management", "edit"),
  documentUpload.single("document"),
  uploadDocumentValidation,
  validate,
  vendorController.uploadVendorDocument
);
router.delete(
  "/:id/documents/:docId",
  requirePermission("vendor_management", "edit"),
  vendorController.deleteVendorDocument
);

export default router;
