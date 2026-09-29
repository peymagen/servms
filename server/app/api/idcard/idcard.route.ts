import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as idcardController from "./idcard.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { requestIdCardValidation, rejectIdCardValidation, updateIdCardStatusLinkValidation } from "./idcard.validation";

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

// Public route — no auth required, used for QR scan verification
router.get("/verify/:code", idcardController.verifyIdCard);

// Protected routes
router.use(roleAuth());

router.get("/", requirePermission("id_card_management", "view"), idcardController.getIdCards);

// Vendor → Issue Request
router.post(
  "/:vendorId/request",
  requirePermission("id_card_management", "create"),
  requestIdCardValidation,
  validate,
  idcardController.requestIdCard
);

// Sub Admin Approval → auto digital signature → QR → PDF (further narrowed to
// users.card_signing_authority=1 inside idcardService.approveIdCard)
router.post(
  "/:vendorId/approve",
  requirePermission("id_card_management", "approve_reject"),
  idcardController.approveIdCard
);
router.post(
  "/:vendorId/reject",
  requirePermission("id_card_management", "approve_reject"),
  rejectIdCardValidation,
  validate,
  idcardController.rejectIdCard
);

router.get("/:vendorId/pdf", requirePermission("id_card_management", "view"), idcardController.downloadIdCardPdf);

// Sets/clears the "Check ID Card Status" Excel link shown on the public QR
// verification page for this card — independent of QR generation/approval.
router.patch(
  "/:vendorId/status-link",
  requirePermission("id_card_management", "edit"),
  updateIdCardStatusLinkValidation,
  validate,
  idcardController.updateIdCardStatusLink
);

export default router;
