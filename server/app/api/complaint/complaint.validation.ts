import { body, param } from "express-validator";

export const createComplaintValidation = [
  body("unit_id")
    .notEmpty().withMessage("unit_id is required")
    .isInt().withMessage("unit_id must be a valid integer"),

  body("category")
    .trim()
    .notEmpty().withMessage("Complaint category is required"),

  body("description")
    .trim()
    .notEmpty().withMessage("Complaint description is required"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"]).withMessage("Priority must be low, medium, or high"),

  body("complaints_status")
    .optional()
    .isIn(["open", "investigating", "resolved", "rejected"]).withMessage("Invalid status value"),
];

export const updateComplaintValidation = [
  param("id").isInt().withMessage("id param must be an integer"),

  body("complaints_status")
    .optional()
    .isIn(["open", "investigating", "resolved", "rejected"]).withMessage("Invalid status value"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"]).withMessage("Priority must be low, medium, or high"),

  body("description")
    .optional()
    .trim()
    .notEmpty().withMessage("Description cannot be empty"),
];
