import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as trainController from "./train.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { createTrainValidation, updateTrainValidation } from "./train.validation";

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.type === "field" ? e.path : "unknown", message: e.msg })),
    });
    return;
  }
  next();
};

const router = Router();
router.use(roleAuth());

router.get("/", requirePermission("location_management", "view"), trainController.getTrains);
router.get("/:id", requirePermission("location_management", "view"), trainController.getTrainById);
router.post(
  "/",
  requirePermission("location_management", "create"),
  createTrainValidation,
  validate,
  trainController.createTrain
);
router.patch(
  "/:id",
  requirePermission("location_management", "edit"),
  updateTrainValidation,
  validate,
  trainController.editTrain
);
router.delete("/:id", requirePermission("location_management", "delete"), trainController.deleteTrain);

export default router;
