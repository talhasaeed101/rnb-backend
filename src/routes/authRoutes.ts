import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/authController.js";
import * as customerAuthController from "../controllers/customerAuthController.js";
import { Admin } from "../models/Admin.js";
import { protect, protectCustomer } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema } from "../validators/authValidator.js";
import {
  emailOnlySchema,
  googleAuthSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyResetOtpSchema,
} from "../validators/customerAuthValidator.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts", errors: [] },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    errors: [],
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests, please try again later",
    errors: [],
  },
});

/**
 * Shared /login path:
 * - Admin emails continue through the existing admin login controller (unchanged).
 * - All other emails use customer login.
 * Admin /me and /logout stay admin-only.
 */
router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res, next) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const admin = await Admin.findOne({ email }).select("_id");
    if (admin) {
      return authController.login(req, res, next);
    }
    return customerAuthController.login(req, res, next);
  }),
);

// Admin session routes (unchanged behavior)
router.get("/me", protect, authController.me);
router.post("/logout", protect, authController.logout);

// Customer auth routes
router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  customerAuthController.register,
);
router.post(
  "/verify-email",
  authLimiter,
  validateBody(verifyEmailSchema),
  customerAuthController.verifyEmail,
);
router.post(
  "/resend-verification",
  otpLimiter,
  validateBody(emailOnlySchema),
  customerAuthController.resendVerification,
);
router.post(
  "/google",
  authLimiter,
  validateBody(googleAuthSchema),
  customerAuthController.googleAuth,
);
router.get("/profile", protectCustomer, customerAuthController.profile);
router.post(
  "/forgot-password",
  otpLimiter,
  validateBody(emailOnlySchema),
  customerAuthController.forgotPassword,
);
router.post(
  "/verify-reset-otp",
  authLimiter,
  validateBody(verifyResetOtpSchema),
  customerAuthController.verifyResetOtp,
);
router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  customerAuthController.resetPassword,
);

export default router;
