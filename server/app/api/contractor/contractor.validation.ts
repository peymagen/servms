import { body, param } from "express-validator";

export const createContractorValidation = [
  body("company_name")
    .trim()
    .notEmpty().withMessage("Contractor/Company name is required"),

  body("primary_contact_name")
    .optional({ nullable: true })
    .trim(),

  body("official_email")
    .optional({ nullable: true })
    .isEmail().withMessage("Must be a valid email address"),

  body("pan_number")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 10, max: 10 }).withMessage("PAN must be exactly 10 characters"),

  body("gstin")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 15, max: 15 }).withMessage("GSTIN must be exactly 15 characters"),

  body("license_validity_date")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid license validity date"),

  body("annual_registration_fee")
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage("Annual registration fee must be a positive number"),

  body("award_date").optional({ nullable: true }).isDate().withMessage("Must be a valid award date"),
  body("tenure_months")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("Tenure must be a positive number of months"),
  body("annual_contract_value")
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage("Annual contract value must be a positive number"),

  body("division_id")
    .notEmpty().withMessage("Division selection is required")
    .isInt().withMessage("division_id must be an integer"),

  body("contractors_status")
    .optional()
    .isIn(["active", "pending_approval", "suspended", "expired"]).withMessage("Invalid status value"),

  body("fee_status")
    .optional()
    .isIn(["paid", "overdue"]).withMessage("Invalid fee status value"),
];

export const updateContractorValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("company_name")
    .optional()
    .trim()
    .notEmpty().withMessage("Company name cannot be empty"),

  body("official_email")
    .optional({ nullable: true })
    .isEmail().withMessage("Must be a valid email address"),

  body("pan_number")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 10, max: 10 }).withMessage("PAN must be exactly 10 characters"),

  body("gstin")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 15, max: 15 }).withMessage("GSTIN must be exactly 15 characters"),

  body("division_id")
    .optional()
    .isInt().withMessage("division_id must be an integer"),

  body("award_date").optional({ nullable: true }).isDate().withMessage("Must be a valid award date"),
  body("tenure_months")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("Tenure must be a positive number of months"),
  body("annual_contract_value")
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage("Annual contract value must be a positive number"),

  body("contractors_status")
    .optional()
    .isIn(["active", "pending_approval", "suspended", "expired"]).withMessage("Invalid status value"),

  body("fee_status")
    .optional()
    .isIn(["paid", "overdue"]).withMessage("Invalid fee status value"),
];

export const changeStatusValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("contractors_status")
    .notEmpty().withMessage("contractors_status is required")
    .isIn(["active", "pending_approval", "suspended", "expired"]).withMessage("Invalid status value"),
  body("reason").optional().isString(),
];

export const assignUnitValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("unit_id").notEmpty().withMessage("unit_id is required").isInt().withMessage("unit_id must be an integer"),
];
