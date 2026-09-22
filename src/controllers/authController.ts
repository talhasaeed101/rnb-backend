import bcrypt from "bcryptjs";
import type { Response } from "express";
import { Admin } from "../models/Admin.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";
import { generateToken } from "../utils/generateToken.js";

function shapeAdmin(admin: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
}) {
  return {
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const admin = await Admin.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );
  if (!admin || admin.status !== "active") {
    throw new AppError("Invalid email or password", 401);
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    throw new AppError("Invalid email or password", 401);
  }

  admin.lastLogin = new Date();
  await admin.save();

  const token = generateToken(admin._id.toString());
  return success(res, {
    token,
    admin: shapeAdmin(admin),
  });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.admin) throw new AppError("Not authorized", 401);
  const admin = await Admin.findById(req.admin.id);
  if (!admin) throw new AppError("Not authorized", 401);
  return success(res, { admin: shapeAdmin(admin) });
});

export const logout = asyncHandler(async (_req, res) => {
  return success(res, { message: "Logged out" });
});
