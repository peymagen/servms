import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as complaintController from "./complaint.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import {
  createComplaintValidation,
  updateComplaintValidation
} from "./complaint.validation";

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

// Secure all complaint endpoints
router.use(roleAuth());

router.get("/metrics", complaintController.getComplaintMetrics);
router.get("/", complaintController.getComplaints);
router.get("/:id", complaintController.getComplaintById);

router.post(
  "/",
  upload.array("evidence", 10),
  createComplaintValidation,
  validate,
  complaintController.createComplaint
);
router.patch("/:id", updateComplaintValidation, validate, complaintController.editComplaint);

export default router;
