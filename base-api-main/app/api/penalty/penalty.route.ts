import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as penaltyController from "./penalty.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import {
  createPenaltyValidation,
  updatePenaltyValidation
} from "./penalty.validation";

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

// Secure all penalty endpoints
router.use(roleAuth());

router.get("/metrics", penaltyController.getPenaltyMetrics);
router.get("/", penaltyController.getPenalties);
router.get("/:id", penaltyController.getPenaltyById);

router.post("/", createPenaltyValidation, validate, penaltyController.createPenalty);
router.patch("/:id", updatePenaltyValidation, validate, penaltyController.editPenalty);

export default router;
