import { body, param } from "express-validator";

export const createClusterValidation = [
  body("division_id").notEmpty().withMessage("Division is required").isInt().withMessage("division_id must be an integer"),
  body("cluster_name").trim().notEmpty().withMessage("Cluster name is required"),
  body("cluster_type").isIn(["station", "train"]).withMessage("cluster_type must be 'station' or 'train'"),
  body("member_ids")
    .isArray({ min: 1 }).withMessage("At least one member (station/train) must be selected")
    .custom((arr: unknown[]) => arr.every((v) => Number.isInteger(v)))
    .withMessage("member_ids must be an array of integers"),
];

export const updateClusterValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("cluster_name").optional().trim().notEmpty().withMessage("Cluster name cannot be empty"),
  body("member_ids")
    .optional()
    .isArray({ min: 1 }).withMessage("At least one member (station/train) must be selected")
    .custom((arr: unknown[]) => arr.every((v) => Number.isInteger(v)))
    .withMessage("member_ids must be an array of integers"),
];
