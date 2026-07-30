import { Router } from "express";
import { type Request, type Response, type NextFunction } from "express";
import { validationResult } from "express-validator";
import * as userController from "./user.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { signatureUpload } from "../../common/middleware/multer.middleware";
import {
  createUserValidation,
  updateUserValidation,
  loginValidation,
  changePasswordValidation,
} from "./user.validation";

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

export default router;
