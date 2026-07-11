import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as vendorController from "./vendor.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import {
  createVendorValidation,
  updateVendorValidation
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

router.get("/metrics", vendorController.getVendorMetrics);
router.get("/", vendorController.getVendors);
router.get("/:id", vendorController.getVendorById);

router.post("/", upload.single("profile_image"), createVendorValidation, validate, vendorController.createVendor);
router.patch("/:id", upload.single("profile_image"), updateVendorValidation, validate, vendorController.editVendor);
router.delete("/:id", vendorController.deleteVendor);

export default router;
