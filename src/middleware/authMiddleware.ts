import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";
import { Customer } from "../models/Customer.js";
import { AppError } from "./errorMiddleware.js";

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  customer?: {
    id: string;
    email: string;
    name: string;
    role: "customer";
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
    if (decoded.role && decoded.role !== "admin") {
      return next(new AppError("Not authorized", 401));
    }
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

export async function protectCustomer(
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
    if (decoded.role !== "customer") {
      return next(new AppError("Not authorized", 401));
    }
    const customer = await Customer.findById(decoded.id);
    if (!customer || customer.status !== "active") {
      return next(new AppError("Not authorized", 401));
    }
    req.customer = {
      id: String(customer._id),
      email: customer.email,
      name: customer.name,
      role: "customer",
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}
