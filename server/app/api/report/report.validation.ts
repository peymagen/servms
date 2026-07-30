import { body, param } from "express-validator";

export const generateReportValidation = [
  body("module_key").trim().notEmpty().withMessage("module_key is required"),
  body("fields").custom((value, { req }) => {
    // Field-array requirement is skipped entirely in grouped mode (group_by present).
    if (req.body.group_by && Array.isArray(req.body.group_by) && req.body.group_by.length > 0) return true;
    if (!Array.isArray(value) || value.length === 0) throw new Error("fields must be a non-empty array");
    return true;
  }),
  body("filters").optional().isArray().withMessage("filters must be an array"),
  body("group_by").optional().isArray().withMessage("group_by must be an array"),
];

export const createTemplateValidation = [
  body("name").trim().notEmpty().withMessage("Report name is required"),
  body("module_key").trim().notEmpty().withMessage("module_key is required"),
  body("fields").isArray({ min: 1 }).withMessage("At least one field must be selected"),
];

export const updateTemplateValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("name").optional().trim().notEmpty().withMessage("Report name cannot be empty"),
];

export const exportReportValidation = [
  body("module_key").trim().notEmpty().withMessage("module_key is required"),
  body("format").isIn(["xlsx", "csv"]).withMessage("format must be xlsx or csv"),
];
