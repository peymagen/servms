import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as unitController from "./unit.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
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

router.get("/metrics", unitController.getUnitMetrics);
router.get("/", unitController.getUnits);
router.get("/:id", unitController.getUnitById);

router.post(
  "/",
  upload.single("sketch_map_file"),
  createUnitValidation,
  validate,
  unitController.createUnit
);
router.patch(
  "/:id",
  upload.single("sketch_map_file"),
  updateUnitValidation,
  validate,
  unitController.editUnit
);
router.delete("/:id", unitController.deleteUnit);

export default router;
