import { body, param } from "express-validator";

export const createUnitValidation = [
  body("unit_code")
    .trim()
    .notEmpty().withMessage("Unit code / ID is required"),

  body("unit_name")
    .trim()
    .notEmpty().withMessage("Unit name is required"),

  body("station_id")
    .notEmpty().withMessage("Station selection is required")
    .isInt().withMessage("station_id must be an integer"),

  body("contractor_id")
    .optional({ nullable: true })
    .isInt().withMessage("contractor_id must be an integer"),

  body("contract_type")
    .optional()
    .isIn(["long_term", "short_term", "temporary"]).withMessage("Invalid contract type"),

  body("monthly_fee")
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage("Monthly fee must be a positive number"),

  body("units_status")
    .optional()
    .isIn(["active", "expiring", "inactive", "inspection_pending"]).withMessage("Invalid status value"),
];

export const updateUnitValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("unit_name")
    .optional()
    .trim()
    .notEmpty().withMessage("Unit name cannot be empty"),

  body("station_id")
    .optional()
    .isInt().withMessage("station_id must be an integer"),

  body("contractor_id")
    .optional({ nullable: true })
    .isInt().withMessage("contractor_id must be an integer"),

  body("contract_type")
    .optional()
    .isIn(["long_term", "short_term", "temporary"]).withMessage("Invalid contract type"),

  body("units_status")
    .optional()
    .isIn(["active", "expiring", "inactive", "inspection_pending"]).withMessage("Invalid status value"),
];
