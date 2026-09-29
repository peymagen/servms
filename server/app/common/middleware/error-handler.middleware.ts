import { type ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { type ErrorResponse } from "../helper/response.hepler";

// Multer's raw error messages ("Unexpected field", "File too large") don't say which
// field/route was involved, which makes a frontend/backend field-name mismatch hard to
// track down. Rewrite them here so the real cause (and the offending field name) is visible.
const describeMulterError = (err: MulterError): string => {
  switch (err.code) {
    case "LIMIT_UNEXPECTED_FILE":
      return `Unexpected file field "${err.field}" — check that the upload form field name matches the field name configured on this route's multer middleware.`;
    case "LIMIT_FILE_SIZE":
      return `File is too large${err.field ? ` for field "${err.field}"` : ""}.`;
    default:
      return err.message;
  }
};

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const isMulterError = err instanceof MulterError;
  const response: ErrorResponse = {
    success: false,
    error_code: (err?.status ?? (isMulterError ? 400 : 500)) as number,
    // mysql2 connection failures (e.g. MySQL not running) surface as an AggregateError
    // with an empty message — fall back to its code (ECONNREFUSED) so the cause is visible.
    message: (isMulterError ? describeMulterError(err) : err?.message || err?.code || "Something went wrong!") as string,
    data: err?.data ?? {},
  };

  res.status(response.error_code).send(response);
  next();
};

export default errorHandler;
