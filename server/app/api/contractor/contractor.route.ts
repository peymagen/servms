import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as contractorController from "./contractor.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import {
  createContractorValidation,
  updateContractorValidation,
} from "./contractor.validation";

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

// Secure all contractor endpoints
router.use(roleAuth());

router.get("/metrics", contractorController.getContractorMetrics);
router.get("/", contractorController.getContractors);
router.get("/:id", contractorController.getContractorById);

router.post(
  "/",
  upload.single("logo_image"),
  createContractorValidation,
  validate,
  contractorController.createContractor
);
router.patch(
  "/:id",
  upload.single("logo_image"),
  updateContractorValidation,
  validate,
  contractorController.editContractor
);
router.delete("/:id", contractorController.deleteContractor);

export default router;
