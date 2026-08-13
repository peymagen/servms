import { body, param } from "express-validator";

export const raiseTransferRequestValidation = [
  body("user_id").notEmpty().withMessage("user_id is required").isInt().withMessage("user_id must be an integer"),
  body("to_division_id").optional().isInt().withMessage("to_division_id must be an integer"),
  body("to_role_id").optional().isInt().withMessage("to_role_id must be an integer"),
  body("reason").optional().isString(),
  body().custom((_, { req }) => {
    if (!req.body.to_division_id && !req.body.to_role_id) {
      throw new Error("At least one of to_division_id or to_role_id is required");
    }
    return true;
  }),
];

export const decideTransferRequestValidation = [
  param("id").isInt().withMessage("id param must be an integer"),
  body("remarks").optional().isString(),
];
