import type { Response } from "express";

export function success(
  res: Response,
  data: unknown = null,
  status = 200,
  extra: Record<string, unknown> = {},
) {
  return res.status(status).json({ success: true, data, ...extra });
}

export function fail(
  res: Response,
  message: string,
  status = 400,
  errors: unknown[] = [],
) {
  return res.status(status).json({ success: false, message, errors });
}
