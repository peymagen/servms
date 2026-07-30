import { body, param } from "express-validator";

export const requestIdCardValidation = [
  param("vendorId").isInt().withMessage("vendorId param must be an integer"),
  body("template")
    .notEmpty().withMessage("template is required")
    .isIn(["template_a", "template_b"]).withMessage("Invalid template value"),
  body("expiry_source")
    .notEmpty().withMessage("expiry_source is required")
    .isIn(["medical", "police_verification"]).withMessage("Invalid expiry_source value"),
];

export const rejectIdCardValidation = [
  param("vendorId").isInt().withMessage("vendorId param must be an integer"),
  body("reason").trim().notEmpty().withMessage("A rejection reason is required"),
];
