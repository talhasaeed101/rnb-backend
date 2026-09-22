import type { NextFunction, Request, Response } from "express";
import { connectDatabase } from "../config/database.js";
import { AppError } from "./errorMiddleware.js";

/** Ensure MongoDB is connected before DB routes (needed on Vercel serverless). */
export async function ensureDb(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    next(
      new AppError(
        "Database unavailable. Check MONGODB_URI on Vercel and Atlas Network Access (allow 0.0.0.0/0).",
        503,
      ),
    );
  }
}
