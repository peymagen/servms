import { body, param } from "express-validator";

export const createPenaltyValidation = [
  body("reference_type")
    .optional()
    .isIn(["complaint", "inspection"]).withMessage("reference_type must be complaint or inspection"),

  body("complaint_id").optional().isInt().withMessage("complaint_id must be a valid integer"),
  body("inspection_id").optional().isInt().withMessage("inspection_id must be a valid integer"),

  body("contractor_id")
    .notEmpty().withMessage("contractor_id is required")
    .isInt().withMessage("contractor_id must be a valid integer"),

  body("vendor_id").optional().isInt().withMessage("vendor_id must be a valid integer"),
  body("unit_id").optional().isInt().withMessage("unit_id must be a valid integer"),

  body("amount")
    .notEmpty().withMessage("Penalty amount is required")
    .isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),

  body("reason")
    .trim()
    .notEmpty().withMessage("Reason for imposing penalty is required"),

  body("due_date").optional().isDate().withMessage("Must be a valid date"),
  body("issued_date").optional().isDate().withMessage("Must be a valid date"),
];

export const updatePenaltyValidation = [
  param("id").isInt().withMessage("id param must be an integer"),

  body("amount").optional().isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),
  body("reason").optional().trim().notEmpty().withMessage("Reason cannot be empty"),
  body("due_date").optional().isDate().withMessage("Must be a valid date"),
  body("remarks").optional().isString(),
];

export const revokePenaltyValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("reason").trim().notEmpty().withMessage("A revocation reason is required"),
];

// Captured at the moment of approval/imposition — all optional since a penalty
// can also still be corrected later via editPenalty.
export const approvePenaltyValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("due_date").optional().isDate().withMessage("Must be a valid date"),
  body("order_number").optional().isString(),
  body("order_date").optional().isDate().withMessage("Must be a valid date"),
  body("remarks").optional().isString(),
];

export const updateRecoveryValidation = [
  param("id").isInt().withMessage("id param must be an integer"),

  // "closed" is deliberately excluded — recovery entry can only reach "recovered";
  // an Admin/Divisional Admin must separately verify it to reach "closed" (see
  // verifyRecoveryValidation / POST /:id/recovery/verify).
  body("recovery_status")
    .notEmpty().withMessage("recovery_status is required")
    .isIn(["pending", "partially_recovered", "recovered"])
    .withMessage("Invalid recovery status value"),

  body("recovery_amount").optional().isFloat({ min: 0 }).withMessage("Recovery amount must be a positive number"),
  body("recovery_date").optional().isDate().withMessage("Must be a valid date"),
  body("payment_reference").optional().isString(),
  body("mr_number").optional().isString(),
  body("mr_date").optional().isDate().withMessage("Must be a valid date"),
  body("order_number").optional().isString(),
  body("order_date").optional().isDate().withMessage("Must be a valid date"),
  body("remarks").optional().isString(),
];

export const verifyRecoveryValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("decision")
    .notEmpty().withMessage("decision is required")
    .isIn(["verified", "rejected"]).withMessage("decision must be 'verified' or 'rejected'"),
  body("remarks").optional().isString(),
];

export const uploadPenaltyDocumentValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("document_type")
    .optional()
    .isIn(["penalty_order", "approval", "recovery_receipt", "other"])
    .withMessage("Invalid document_type value"),
];
