import { body, param } from "express-validator";

export const createPenaltyValidation = [
  body("contractor_id")
    .notEmpty().withMessage("contractor_id is required")
    .isInt().withMessage("contractor_id must be a valid integer"),

  body("amount")
    .notEmpty().withMessage("Penalty amount is required")
    .isFloat({ min: 0 }).withMessage("Amount must be a positive number"),

  body("reason")
    .trim()
    .notEmpty().withMessage("Reason for imposing penalty is required"),

  body("penalties_status")
    .optional()
    .isIn(["pending", "recovered", "waived"]).withMessage("Invalid status value"),

  body("issued_date")
    .optional()
    .isDate().withMessage("Must be a valid date"),
];

export const updatePenaltyValidation = [
  param("id").isInt().withMessage("id param must be an integer"),

  body("penalties_status")
    .optional()
    .isIn(["pending", "recovered", "waived"]).withMessage("Invalid status value"),

  body("amount")
    .optional()
    .isFloat({ min: 0 }).withMessage("Amount must be a positive number"),

  body("reason")
    .optional()
    .trim()
    .notEmpty().withMessage("Reason cannot be empty"),
];
