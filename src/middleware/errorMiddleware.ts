import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;
  errors: unknown[];

  constructor(message: string, statusCode = 400, errors: unknown[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Multer (multipart uploads)
  if (
    typeof err === "object" &&
    err &&
    "name" in err &&
    (err as { name?: string }).name === "MulterError"
  ) {
    const code = (err as { code?: string }).code;
    const message =
      code === "LIMIT_FILE_COUNT"
        ? "Too many images in one upload (max 24)"
        : code === "LIMIT_FILE_SIZE"
          ? "An image is larger than 10MB"
          : code === "LIMIT_UNEXPECTED_FILE"
            ? "Unexpected upload field. Use images, image, or files."
            : "Image upload failed";
    return res.status(400).json({
      success: false,
      message,
      errors: [{ code }],
    });
  }
  if (
    typeof err === "object" &&
    err &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    return res.status(409).json({
      success: false,
      message: "Duplicate key error",
      errors: [],
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    errors: [],
  });
}
