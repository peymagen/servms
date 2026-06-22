import { body, param } from "express-validator";

export const createVendorValidation = [
  body("full_name")
    .trim()
    .notEmpty().withMessage("Vendor full name is required"),

  body("aadhaar_number")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 12, max: 12 }).withMessage("Aadhaar number must be exactly 12 digits"),

  body("mobile_number")
    .trim()
    .notEmpty().withMessage("Mobile number is required"),

  body("division_id")
    .notEmpty().withMessage("Division selection is required")
    .isInt().withMessage("division_id must be an integer"),

  body("station_id")
    .notEmpty().withMessage("Station selection is required")
    .isInt().withMessage("station_id must be an integer"),

  body("contractor_id")
    .notEmpty().withMessage("Contractor selection is required")
    .isInt().withMessage("contractor_id must be an integer"),

  body("unit_id")
    .notEmpty().withMessage("Platform unit stall selection is required")
    .isInt().withMessage("unit_id must be an integer"),

  body("validity_start")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid validity start date"),

  body("validity_end")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid validity end date"),

  body("vendor_status")
    .optional()
    .isIn(["active", "pending", "expired"]).withMessage("Invalid vendor status value"),
];

export const updateVendorValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("full_name")
    .optional()
    .trim()
    .notEmpty().withMessage("Vendor name cannot be empty"),

  body("aadhaar_number")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 12, max: 12 }).withMessage("Aadhaar number must be exactly 12 digits"),

  body("mobile_number")
    .optional()
    .trim()
    .notEmpty().withMessage("Mobile number cannot be empty"),

  body("division_id")
    .optional()
    .isInt().withMessage("division_id must be an integer"),

  body("station_id")
    .optional()
    .isInt().withMessage("station_id must be an integer"),

  body("contractor_id")
    .optional()
    .isInt().withMessage("contractor_id must be an integer"),

  body("unit_id")
    .optional()
    .isInt().withMessage("unit_id must be an integer"),

  body("vendor_status")
    .optional()
    .isIn(["active", "pending", "expired"]).withMessage("Invalid vendor status value"),
];
