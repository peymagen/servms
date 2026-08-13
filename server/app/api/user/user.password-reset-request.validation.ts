import { body, param } from "express-validator";

export const raisePasswordResetRequestValidation = [
  body("requested_user_id").optional().isInt().withMessage("requested_user_id must be an integer"),
  body("reason").optional().isString(),
];

export const decidePasswordResetRequestValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("remarks").optional().isString(),
];
