import { body, param } from "express-validator";
import { MODULE_NAMES } from "./role.dto";

export const createRoleValidation = [
  body("role_name")
    .trim()
    .notEmpty().withMessage("Role name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Role name must be 2–50 chars"),

  body("description")
    .optional({ nullable: true })
    .trim(),
];

export const updateRoleValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("role_name")
    .optional()
    .trim()
    .notEmpty().withMessage("Role name cannot be empty"),

  body("roles_status")
    .optional()
    .isIn(["active", "inactive"]).withMessage("Invalid status value"),
];

export const updatePermissionsValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("permissions")
    .isArray({ min: 1 }).withMessage("permissions must be a non-empty array"),

  body("permissions.*.module_name")
    .isIn(MODULE_NAMES).withMessage("Invalid module_name"),

  body("permissions.*.can_view").isBoolean(),
  body("permissions.*.can_create").isBoolean(),
  body("permissions.*.can_edit").isBoolean(),
  body("permissions.*.can_delete").isBoolean(),
  body("permissions.*.can_approve_reject").isBoolean(),
  body("permissions.*.can_export").isBoolean(),
];
