import { body, param } from "express-validator";

export const createUserValidation = [
  body("employee_id")
    .trim()
    .notEmpty().withMessage("Employee ID is required"),

  body("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .isLength({ min: 3, max: 50 }).withMessage("Username must be 3–50 chars"),

  body("full_name")
    .trim()
    .notEmpty().withMessage("Full name is required"),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

  body("role_id")
    .isInt().withMessage("role_id must be a valid integer"),

  body("division_id")
    .optional({ nullable: true })
    .isInt().withMessage("division_id must be an integer"),

  body("station_id")
    .optional({ nullable: true })
    .isInt().withMessage("station_id must be an integer"),

  body("email")
    .optional({ nullable: true })
    .isEmail().withMessage("Must be a valid email address"),

  body("mobile")
    .optional({ nullable: true })
    .trim(),

  body("users_status")
    .optional()
    .isIn(["active", "inactive", "suspended", "pending_approval"]).withMessage("Invalid status value"),

  body("designation")
    .optional({ nullable: true })
    .trim(),

  body("hrms_id")
    .optional({ nullable: true })
    .trim(),

  body("zone_id")
    .optional({ nullable: true })
    .isInt().withMessage("zone_id must be an integer"),

  body("designation_grade")
    .optional({ nullable: true })
    .isIn(["JAG", "SG", "SR_SUPERVISOR", "JS", "SS", "OTHER"]).withMessage("Invalid designation grade"),

  body("card_signing_authority")
    .optional()
    .toBoolean(),
];

export const updateUserValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("employee_id")
    .optional()
    .trim()
    .notEmpty().withMessage("Employee ID cannot be empty"),

  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage("Username must be 3–50 chars"),

  body("full_name")
    .optional()
    .trim(),

  body("password")
    .optional()
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

  body("role_id")
    .optional()
    .isInt().withMessage("role_id must be a valid integer"),

  body("division_id")
    .optional({ nullable: true })
    .isInt().withMessage("division_id must be an integer"),

  body("station_id")
    .optional({ nullable: true })
    .isInt().withMessage("station_id must be an integer"),

  body("email")
    .optional({ nullable: true })
    .isEmail().withMessage("Must be a valid email address"),

  body("mobile")
    .optional({ nullable: true }),

  body("users_status")
    .optional()
    .isIn(["active", "inactive", "suspended", "pending_approval"]).withMessage("Invalid status value"),

  body("designation")
    .optional({ nullable: true })
    .trim(),

  body("hrms_id")
    .optional({ nullable: true })
    .trim(),

  body("zone_id")
    .optional({ nullable: true })
    .isInt().withMessage("zone_id must be an integer"),

  body("designation_grade")
    .optional({ nullable: true })
    .isIn(["JAG", "SG", "SR_SUPERVISOR", "JS", "SS", "OTHER"]).withMessage("Invalid designation grade"),

  body("card_signing_authority")
    .optional()
    .toBoolean(),
];

export const loginValidation = [
  body("username")
    .trim()
    .notEmpty().withMessage("Username is required"),

  body("password")
    .notEmpty().withMessage("Password is required"),
];

export const changePasswordValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];