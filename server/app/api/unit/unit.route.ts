import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as unitController from "./unit.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import { createUnitValidation, updateUnitValidation } from "./unit.validation";

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

router.get("/metrics", requirePermission("unit_management", "view"), unitController.getUnitMetrics);
router.get("/", requirePermission("unit_management", "view"), unitController.getUnits);
router.get("/:id", requirePermission("unit_management", "view"), unitController.getUnitById);

router.post(
  "/",
  requirePermission("unit_management", "create"),
  upload.single("sketch_map_file"),
  createUnitValidation,
  validate,
  unitController.createUnit
);
router.patch(
  "/:id",
  requirePermission("unit_management", "edit"),
  upload.single("sketch_map_file"),
  updateUnitValidation,
  validate,
  unitController.editUnit
);
router.delete("/:id", requirePermission("unit_management", "delete"), unitController.deleteUnit);

export default router;
