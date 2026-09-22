import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function generateToken(adminId: string): string {
  return jwt.sign({ id: adminId, role: "admin" }, env.jwtSecret, {
    expiresIn: "7d",
  });
}

export function generateCustomerToken(customerId: string): string {
  return jwt.sign({ id: customerId, role: "customer" }, env.jwtSecret, {
    expiresIn: "7d",
  });
}
