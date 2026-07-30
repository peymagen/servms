import { body, param } from "express-validator";

export const createInspectionValidation = [
  body("unit_id")
    .notEmpty().withMessage("Unit of Inspection is required")
    .isInt().withMessage("unit_id must be a valid integer"),

  body("inspection_date")
    .notEmpty().withMessage("Date of Inspection is required")
    .isISO8601().withMessage("inspection_date must be a valid date"),

  body("inspection_category_id")
    .notEmpty().withMessage("Inspection Category is required")
    .isInt().withMessage("inspection_category_id must be a valid integer"),

  body("inspection_type_id")
    .notEmpty().withMessage("Inspection Type is required")
    .isInt().withMessage("inspection_type_id must be a valid integer"),

  body("observations").optional().trim(),
  body("deficiencies").optional().trim(),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"]).withMessage("Priority must be low, medium, or high"),
];

export const updateInspectionValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("priority").optional().isIn(["low", "medium", "high"]).withMessage("Priority must be low, medium, or high"),
  body("inspection_date").optional().isISO8601().withMessage("inspection_date must be a valid date"),
];

export const assignInspectionValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("to_unit_id").notEmpty().withMessage("Responsible Unit is required").isInt(),
  body("assigned_to_user_id").optional({ nullable: true }).isInt(),
  body("remarks").optional().trim(),
];

export const submitAtrValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("action_description").trim().notEmpty().withMessage("Action Description is required"),
  body("action_date").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("completion_status").optional().isIn(["in_progress", "partially_completed", "completed"]),
];

export const atrDecisionValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  param("atrId").isInt().withMessage("atrId param must be an integer"),
  body("remarks").optional().trim(),
];
