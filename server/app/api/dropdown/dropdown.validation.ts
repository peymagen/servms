import { body, param } from "express-validator";

export const createDropdownValidation = [
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("value")
    .trim()
    .notEmpty().withMessage("Value is required")
    .matches(/^[a-z0-9_]+$/).withMessage("Value must be lowercase snake_case (letters, digits, underscore)"),
  body("label").trim().notEmpty().withMessage("Label is required"),
  body("division_id").optional({ nullable: true }).isInt().withMessage("division_id must be an integer"),
  body("parent_id").optional({ nullable: true }).isInt().withMessage("parent_id must be an integer"),
  body("sort_order").optional().isInt().withMessage("sort_order must be an integer"),
];

export const updateDropdownValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("label").optional().trim().notEmpty().withMessage("Label cannot be empty"),
  body("sort_order").optional().isInt().withMessage("sort_order must be an integer"),
];
