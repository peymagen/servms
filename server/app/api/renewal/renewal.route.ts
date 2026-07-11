import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as renewalController from "./renewal.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import { createRenewalValidation, updateRenewalValidation } from "./renewal.validation";

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

router.use(roleAuth());

router.get("/", renewalController.getRenewals);
router.get("/:id", renewalController.getRenewalById);

router.post(
  "/",
  upload.single("medical_fitness_doc"),
  createRenewalValidation,
  validate,
  renewalController.createRenewal
);
router.patch(
  "/:id",
  updateRenewalValidation,
  validate,
  renewalController.updateRenewalStatus
);

export default router;
