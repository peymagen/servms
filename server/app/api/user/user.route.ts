import { Router } from "express";
import { type Request, type Response, type NextFunction } from "express";
import { validationResult } from "express-validator";
import * as userController from "./user.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
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
router.post("/", createUserValidation, validate, userController.createUser);
router.get("/", userController.getAllUser);
router.get("/:id", userController.getUserById);
router.put("/:id", updateUserValidation, validate, userController.updateUser);
router.patch("/:id", updateUserValidation, validate, userController.editUser);
router.delete("/:id", userController.deleteUser);

// Status and password controls
router.patch("/:id/change-password", changePasswordValidation, validate, userController.changePassword);
router.patch("/:id/toggle", userController.toggleStatus);

export default router;
