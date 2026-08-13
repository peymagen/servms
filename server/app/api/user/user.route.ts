import { Router } from "express";
import { type Request, type Response, type NextFunction } from "express";
import { validationResult } from "express-validator";
import * as userController from "./user.controller";
import * as passwordResetController from "./user.password-reset-request.controller";
import * as transferController from "./user.transfer-request.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { signatureUpload } from "../../common/middleware/multer.middleware";
import {
  createUserValidation,
  updateUserValidation,
  loginValidation,
  changePasswordValidation,
} from "./user.validation";
import {
  raisePasswordResetRequestValidation,
  decidePasswordResetRequestValidation,
} from "./user.password-reset-request.validation";
import { raiseTransferRequestValidation, decideTransferRequestValidation } from "./user.transfer-request.validation";

// Inline validator — no external middleware import needed
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

// Auth
router.post("/login", loginValidation, validate, userController.loginUser);

// Everything below requires a valid JWT
router.use(roleAuth());

// CRUD
router.post(
  "/",
  requirePermission("user_management", "create"),
  signatureUpload.single("signature"),
  createUserValidation,
  validate,
  userController.createUser
);
router.get("/", requirePermission("user_management", "view"), userController.getAllUser);

// ─── Password Reset Requests (must precede /:id) ────────────────────────────────
// "Request should be raised to servmshqadmin@gmail.com" — raising is open to any
// authenticated user (self-service, or an admin on someone's behalf); only
// user_management.approve_reject can review/decide, mirroring the existing
// user approve/reject convention below.
router.post(
  "/password-reset-requests",
  raisePasswordResetRequestValidation,
  validate,
  passwordResetController.raisePasswordResetRequest
);
router.get(
  "/password-reset-requests",
  requirePermission("user_management", "approve_reject"),
  passwordResetController.getPasswordResetRequests
);
router.post(
  "/password-reset-requests/:id/approve",
  requirePermission("user_management", "approve_reject"),
  decidePasswordResetRequestValidation,
  validate,
  passwordResetController.approvePasswordResetRequest
);
router.post(
  "/password-reset-requests/:id/reject",
  requirePermission("user_management", "approve_reject"),
  decidePasswordResetRequestValidation,
  validate,
  passwordResetController.rejectPasswordResetRequest
);

// ─── User Transfer Requests (must precede /:id) ─────────────────────────────────
// "Transfer Request Raised → HQ Admin Review → Approval → User Division/Role
// Updated" — raising requires edit access (an admin initiating on a user's
// behalf); review/decide requires approve_reject, same HQ-Admin-tier gate as
// every other approval workflow in this codebase.
router.post(
  "/transfer-requests",
  requirePermission("user_management", "edit"),
  raiseTransferRequestValidation,
  validate,
  transferController.raiseTransferRequest
);
router.get(
  "/transfer-requests",
  requirePermission("user_management", "approve_reject"),
  transferController.getTransferRequests
);
router.post(
  "/transfer-requests/:id/approve",
  requirePermission("user_management", "approve_reject"),
  decideTransferRequestValidation,
  validate,
  transferController.approveTransferRequest
);
router.post(
  "/transfer-requests/:id/reject",
  requirePermission("user_management", "approve_reject"),
  decideTransferRequestValidation,
  validate,
  transferController.rejectTransferRequest
);

router.get("/:id", requirePermission("user_management", "view"), userController.getUserById);
router.put(
  "/:id",
  requirePermission("user_management", "edit"),
  signatureUpload.single("signature"),
  updateUserValidation,
  validate,
  userController.updateUser
);
router.patch(
  "/:id",
  requirePermission("user_management", "edit"),
  signatureUpload.single("signature"),
  updateUserValidation,
  validate,
  userController.editUser
);
router.delete("/:id", requirePermission("user_management", "delete"), userController.deleteUser);

// Status and password controls
router.patch("/:id/change-password", changePasswordValidation, validate, userController.changePassword);
router.patch("/:id/toggle", requirePermission("user_management", "edit"), userController.toggleStatus);

// ─── Approval workflow (Divisional/HQ Admin only, via can_approve_reject) ───────
// Dedicated actions so a sub-admin (who holds can_edit but not
// can_approve_reject) can never move a user out of pending_approval via the
// generic PATCH /:id path.
router.post("/:id/approve", requirePermission("user_management", "approve_reject"), userController.approveUser);
router.post("/:id/reject", requirePermission("user_management", "approve_reject"), userController.rejectUser);

export default router;
