import { body, param } from "express-validator";

// Exactly one of station_id/train_id/cluster_id must be set, matching location_type
// (multipart form fields arrive as strings, so treat any non-empty value as "set").
const locationMatchesType = (body: Record<string, unknown>) => {
  const type = body.location_type;
  const has = (key: string) => body[key] !== undefined && body[key] !== null && body[key] !== "";
  if (type === "station" && !has("station_id")) throw new Error("station_id is required when location_type is 'station'");
  if (type === "train" && !has("train_id")) throw new Error("train_id is required when location_type is 'train'");
  if (type === "cluster" && !has("cluster_id")) throw new Error("cluster_id is required when location_type is 'cluster'");
  return true;
};

export const createUnitValidation = [
  body("unit_code").trim().notEmpty().withMessage("Unit code / ID is required"),
  body("unit_name").trim().notEmpty().withMessage("Unit name is required"),

  body("location_type")
    .notEmpty().withMessage("Location type is required")
    .isIn(["station", "train", "cluster"]).withMessage("location_type must be station, train, or cluster"),
  body().custom(locationMatchesType),

  body("station_id").optional({ nullable: true }).isInt().withMessage("station_id must be an integer"),
  body("train_id").optional({ nullable: true }).isInt().withMessage("train_id must be an integer"),
  body("cluster_id").optional({ nullable: true }).isInt().withMessage("cluster_id must be an integer"),

  body("contractor_id").optional({ nullable: true }).isInt().withMessage("contractor_id must be an integer"),

  body("contract_type")
    .optional({ nullable: true })
    .isIn(["earning", "expenditure"]).withMessage("contract_type must be 'earning' or 'expenditure'"),

  body("contract_category_id")
    .optional({ nullable: true })
    .isInt().withMessage("contract_category_id must be an integer"),

  body("duration_type")
    .optional()
    .isIn(["long_term", "short_term", "temporary"]).withMessage("Invalid duration type"),

  body("monthly_fee")
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage("Monthly fee must be a positive number"),

  body("units_status")
    .optional()
    .isIn(["active", "expiring", "inactive", "inspection_pending"]).withMessage("Invalid status value"),
];

export const updateUnitValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("unit_name").optional().trim().notEmpty().withMessage("Unit name cannot be empty"),

  body("location_type")
    .optional()
    .isIn(["station", "train", "cluster"]).withMessage("location_type must be station, train, or cluster"),
  body().custom((value, { req }) => {
    if (req.body.location_type === undefined) return true;
    return locationMatchesType(req.body);
  }),

  body("station_id").optional({ nullable: true }).isInt().withMessage("station_id must be an integer"),
  body("train_id").optional({ nullable: true }).isInt().withMessage("train_id must be an integer"),
  body("cluster_id").optional({ nullable: true }).isInt().withMessage("cluster_id must be an integer"),

  body("contractor_id").optional({ nullable: true }).isInt().withMessage("contractor_id must be an integer"),

  body("contract_type")
    .optional({ nullable: true })
    .isIn(["earning", "expenditure"]).withMessage("contract_type must be 'earning' or 'expenditure'"),

  body("contract_category_id")
    .optional({ nullable: true })
    .isInt().withMessage("contract_category_id must be an integer"),

  body("duration_type")
    .optional()
    .isIn(["long_term", "short_term", "temporary"]).withMessage("Invalid duration type"),

  body("units_status")
    .optional()
    .isIn(["active", "expiring", "inactive", "inspection_pending"]).withMessage("Invalid status value"),
];
