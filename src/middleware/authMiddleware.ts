import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";
import { AppError } from "./errorMiddleware.js";

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface JwtPayload {
  id: string;
  role?: string;
}

export async function protect(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Not authorized", 401));
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    const admin = await Admin.findById(decoded.id).select("-passwordHash");
    if (!admin || admin.status !== "active") {
      return next(new AppError("Not authorized", 401));
    }
    req.admin = {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}
