import { body, param } from "express-validator";

// Contractor status is intentionally absent from create/update — it only changes
// through changeStatusValidation's dedicated, approve_reject-gated endpoint.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

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
    .optional({ nullable: true, values: "falsy" })
    .trim()
    .toUpperCase()
    .matches(PAN_REGEX).withMessage("PAN must be in the format ABCDE1234F"),

  body("gstin")
    .optional({ nullable: true, values: "falsy" })
    .trim()
    .toUpperCase()
    .matches(GSTIN_REGEX).withMessage("GSTIN must be a valid 15-character GST number (e.g. 20ABCDE1234F1Z5)"),

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
    .optional({ nullable: true, values: "falsy" })
    .trim()
    .toUpperCase()
    .matches(PAN_REGEX).withMessage("PAN must be in the format ABCDE1234F"),

  body("gstin")
    .optional({ nullable: true, values: "falsy" })
    .trim()
    .toUpperCase()
    .matches(GSTIN_REGEX).withMessage("GSTIN must be a valid 15-character GST number (e.g. 20ABCDE1234F1Z5)"),

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

  body("fee_status")
    .optional()
    .isIn(["paid", "overdue"]).withMessage("Invalid fee status value"),
];

export const changeStatusValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("contractors_status")
    .notEmpty().withMessage("contractors_status is required")
    // "blacklisted" is only settable through this dedicated status-change action,
    // not via createContractorValidation/updateContractorValidation, since it's
    // meant to be a deliberate gated decision rather than an incidental edit.
    .isIn(["active", "pending_approval", "suspended", "expired", "blacklisted"]).withMessage("Invalid status value"),
  body("reason").optional().isString(),
];

export const assignUnitValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("unit_id").notEmpty().withMessage("unit_id is required").isInt().withMessage("unit_id must be an integer"),
];
