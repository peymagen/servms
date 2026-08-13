import { body, param } from "express-validator";

export const createRenewalValidation = [
  body("vendor_id")
    .notEmpty().withMessage("Vendor selection is required")
    .isInt().withMessage("vendor_id must be an integer"),

  body("renewal_period")
    .optional({ nullable: true })
    .trim(),

  body("renewal_type")
    .optional({ nullable: true })
    .isIn(["pvr", "medical", "both"]).withMessage("Invalid renewal type"),

  body("new_expiry")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid new expiry date"),

  body("pvr_number")
    .optional({ nullable: true })
    .trim(),

  body("pvr_issue_date")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid PVR issue date"),

  body("medical_issue_date")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid medical certificate issue date"),

  body("medical_number")
    .optional({ nullable: true })
    .trim(),

  body("renewals_status")
    .optional()
    .isIn(["draft", "pending_approval"]).withMessage("Invalid renewal status"),
];

export const updateRenewalValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("renewals_status")
    .notEmpty().withMessage("renewals_status is required")
    .isIn(["draft", "pending_approval", "approved", "rejected"]).withMessage("Invalid renewal status"),
];
