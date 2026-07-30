import { body, param } from "express-validator";

export const createTrainValidation = [
  body("division_id").notEmpty().withMessage("Owning division is required").isInt().withMessage("division_id must be an integer"),
  body("train_number").trim().notEmpty().withMessage("Train number is required"),
  body("train_name").trim().notEmpty().withMessage("Train name is required"),
  body("source").trim().notEmpty().withMessage("Source is required"),
  body("destination").trim().notEmpty().withMessage("Destination is required"),
  body("opposite_train_number").optional({ nullable: true }).isString(),
  body("opposite_train_name").optional({ nullable: true }).isString(),
  body("opposite_source").optional({ nullable: true }).isString(),
  body("opposite_destination").optional({ nullable: true }).isString(),
];

export const updateTrainValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("division_id").optional().isInt().withMessage("division_id must be an integer"),
  body("train_number").optional().trim().notEmpty().withMessage("Train number cannot be empty"),
  body("train_name").optional().trim().notEmpty().withMessage("Train name cannot be empty"),
  body("source").optional().trim().notEmpty().withMessage("Source cannot be empty"),
  body("destination").optional().trim().notEmpty().withMessage("Destination cannot be empty"),
];
