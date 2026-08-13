import { body, param } from "express-validator";

// Manual entry supports CPGRAMS, Manual Complaint, and single-record RailMadad
// sources — bulk RailMadad complaints are still normally registered via the
// Excel import endpoint, but a single one can also be entered here directly.
export const createComplaintValidation = [
  body("unit_id")
    .notEmpty().withMessage("Concerned Unit is required")
    .isInt().withMessage("unit_id must be a valid integer"),

  body("complaint_source")
    .optional()
    .isIn(["railmadad", "cpgrams", "manual"]).withMessage("complaint_source must be railmadad, cpgrams, or manual"),

  body("portal_registration_number")
    .if(body("complaint_source").equals("cpgrams"))
    .trim()
    .notEmpty().withMessage("Portal Registration Number is required for CPGRAMS complaints"),

  body("complaint_ref_no")
    .if(body("complaint_source").equals("railmadad"))
    .trim()
    .notEmpty().withMessage("RailMadad Reference Number is required for RailMadad complaints"),

  body("complaint_type_id")
    .notEmpty().withMessage("Complaint Type is required")
    .isInt().withMessage("complaint_type_id must be a valid integer"),

  body("complaint_subtype_id")
    .notEmpty().withMessage("Complaint Sub-type is required")
    .isInt().withMessage("complaint_subtype_id must be a valid integer"),

  body("description")
    .trim()
    .notEmpty().withMessage("Complaint description is required"),

  body("complainant_mobile")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{10,15}$/).withMessage("Enter a valid mobile number"),

  body("complainant_email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage("Enter a valid email address"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"]).withMessage("Priority must be low, medium, or high"),
];

export const updateComplaintValidation = [
  param("id").isInt().withMessage("id param must be an integer"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"]).withMessage("Priority must be low, medium, or high"),

  body("description")
    .optional()
    .trim()
    .notEmpty().withMessage("Description cannot be empty"),

  body("complainant_mobile")
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{10,15}$/).withMessage("Enter a valid mobile number"),

  body("complainant_email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage("Enter a valid email address"),
];

export const assignComplaintValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("to_unit_id").notEmpty().withMessage("Concerned Unit is required").isInt(),
  body("assigned_to_user_id").optional({ nullable: true }).isInt(),
  body("remarks").optional().trim(),
];

export const submitAtrValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("remarks").trim().notEmpty().withMessage("Action Taken remarks are required"),
];

export const atrDecisionValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  param("atrId").isInt().withMessage("atrId param must be an integer"),
  body("remarks").optional().trim(),
];
