import bcrypt from "bcryptjs";
import type { Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { Customer } from "../models/Customer.js";
import { success } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  isSmtpConfigured,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/email.js";
import { generateCustomerToken } from "../utils/generateToken.js";
import {
  generateOtp,
  generateResetToken,
  hashOtp,
  hashToken,
  minutesFromNow,
} from "../utils/otp.js";
import { shapeCustomer } from "../utils/shapeCustomer.js";

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MINUTES = 10;
const RESET_TOKEN_TTL_MINUTES = 30;

const googleClient = env.googleClientId
  ? new OAuth2Client(env.googleClientId)
  : null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function issueVerificationOtp(customer: {
  _id: { toString(): string };
  email: string;
  name: string;
}) {
  if (!isSmtpConfigured()) {
    throw new AppError(
      "Email delivery is not configured. Please try again later.",
      503,
    );
  }

  const otp = generateOtp();
  await Customer.findByIdAndUpdate(customer._id, {
    verificationOtpHash: hashOtp(otp),
    verificationOtpExpiresAt: minutesFromNow(OTP_TTL_MINUTES),
  });

  try {
    await sendVerificationEmail({
      to: customer.email,
      name: customer.name,
      otp,
    });
  } catch (error) {
    console.error("Failed to send verification email:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw new AppError(
      "Unable to send verification email right now. Please try again.",
      503,
    );
  }
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as {
    name: string;
    email: string;
    password: string;
  };

  const normalizedEmail = normalizeEmail(email);
  const existing = await Customer.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const customer = await Customer.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    emailVerified: false,
    authProvider: "local",
    status: "active",
  });

  await issueVerificationOtp(customer);

  return success(
    res,
    {
      email: customer.email,
      emailVerificationRequired: true,
    },
    201,
  );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body as { email: string; otp: string };
  const normalizedEmail = normalizeEmail(email);

  const customer = await Customer.findOne({ email: normalizedEmail }).select(
    "+verificationOtpHash +verificationOtpExpiresAt",
  );

  if (
    !customer ||
    !customer.verificationOtpHash ||
    !customer.verificationOtpExpiresAt
  ) {
    throw new AppError("Invalid or expired verification code", 400);
  }

  if (customer.verificationOtpExpiresAt.getTime() < Date.now()) {
    throw new AppError("Verification code has expired", 400);
  }

  if (customer.verificationOtpHash !== hashOtp(String(otp).trim())) {
    throw new AppError("Invalid or expired verification code", 400);
  }

  customer.emailVerified = true;
  customer.verificationOtpHash = null;
  customer.verificationOtpExpiresAt = null;
  await customer.save();

  return success(res, { message: "Email verified successfully" });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };
  const normalizedEmail = normalizeEmail(email);
  const generic = {
    message:
      "If an unverified account exists for this email, a new code has been sent.",
  };

  const customer = await Customer.findOne({ email: normalizedEmail });
  if (!customer || customer.status !== "active" || customer.emailVerified) {
    return success(res, generic);
  }

  try {
    await issueVerificationOtp(customer);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Failed to resend verification email");
  }

  return success(res, generic);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const normalizedEmail = normalizeEmail(email);

  const customer = await Customer.findOne({ email: normalizedEmail }).select(
    "+passwordHash",
  );

  if (!customer || customer.status !== "active") {
    throw new AppError("Invalid email or password", 401);
  }

  if (!customer.passwordHash) {
    throw new AppError(
      "This account uses Google sign-in. Please continue with Google.",
      400,
    );
  }

  const match = await bcrypt.compare(password, customer.passwordHash);
  if (!match) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!customer.emailVerified) {
    throw new AppError("Email not verified", 403);
  }

  const token = generateCustomerToken(customer._id.toString());
  return success(res, {
    token,
    customer: shapeCustomer(customer),
  });
});

export const profile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Not authorized", 401);

  const customer = await Customer.findById(req.customer.id);
  if (!customer || customer.status !== "active") {
    throw new AppError("Not authorized", 401);
  }

  return success(res, { customer: shapeCustomer(customer) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };
  const normalizedEmail = normalizeEmail(email);
  const generic = {
    message:
      "If an account exists for this email, a password reset code has been sent.",
  };

  const customer = await Customer.findOne({ email: normalizedEmail });
  if (!customer || customer.status !== "active") {
    return success(res, generic);
  }

  if (!isSmtpConfigured()) {
    return success(res, generic);
  }

  const otp = generateOtp();
  customer.resetOtpHash = hashOtp(otp);
  customer.resetOtpExpiresAt = minutesFromNow(OTP_TTL_MINUTES);
  customer.passwordResetTokenHash = null;
  customer.passwordResetTokenExpiresAt = null;
  await customer.save();

  try {
    await sendPasswordResetEmail({
      to: customer.email,
      name: customer.name,
      otp,
    });
  } catch (error) {
    customer.resetOtpHash = null;
    customer.resetOtpExpiresAt = null;
    await customer.save();
    console.error("Failed to send password reset email:", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  return success(res, generic);
});

export const verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body as { email: string; otp: string };
  const normalizedEmail = normalizeEmail(email);

  const customer = await Customer.findOne({ email: normalizedEmail }).select(
    "+resetOtpHash +resetOtpExpiresAt",
  );

  if (!customer || !customer.resetOtpHash || !customer.resetOtpExpiresAt) {
    throw new AppError("Invalid or expired reset code", 400);
  }

  if (customer.resetOtpExpiresAt.getTime() < Date.now()) {
    throw new AppError("Reset code has expired", 400);
  }

  if (customer.resetOtpHash !== hashOtp(String(otp).trim())) {
    throw new AppError("Invalid or expired reset code", 400);
  }

  const resetToken = generateResetToken();
  customer.resetOtpHash = null;
  customer.resetOtpExpiresAt = null;
  customer.passwordResetTokenHash = hashToken(resetToken);
  customer.passwordResetTokenExpiresAt = minutesFromNow(
    RESET_TOKEN_TTL_MINUTES,
  );
  await customer.save();

  return success(res, { resetToken });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body as {
    resetToken: string;
    password: string;
  };

  const tokenHash = hashToken(resetToken);
  const customer = await Customer.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetTokenExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetTokenExpiresAt");

  if (!customer) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  customer.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  customer.passwordResetTokenHash = null;
  customer.passwordResetTokenExpiresAt = null;
  customer.resetOtpHash = null;
  customer.resetOtpExpiresAt = null;
  if (customer.authProvider === "google") {
    customer.authProvider = "both";
  }
  await customer.save();

  return success(res, { message: "Password reset successfully" });
});

export const googleAuth = asyncHandler(async (req, res) => {
  if (!env.googleClientId || !googleClient) {
    throw new AppError("Google sign-in is not configured", 503);
  }

  const { credential } = req.body as { credential?: string };
  if (!credential) {
    throw new AppError("Google credential is required", 400);
  }

  let payload: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload() || {};
  } catch {
    throw new AppError("Invalid Google credential", 401);
  }

  const googleId = payload.sub;
  const email = payload.email ? normalizeEmail(payload.email) : "";
  if (!googleId || !email) {
    throw new AppError("Google account is missing required profile data", 400);
  }
  if (payload.email_verified === false) {
    throw new AppError("Google email is not verified", 400);
  }

  let customer = await Customer.findOne({
    $or: [{ googleId }, { email }],
  }).select("+googleId +passwordHash");

  if (customer) {
    if (customer.status !== "active") {
      throw new AppError("Account is inactive", 403);
    }
    if (!customer.googleId) {
      customer.googleId = googleId;
    }
    if (!customer.emailVerified) {
      customer.emailVerified = true;
      customer.verificationOtpHash = null;
      customer.verificationOtpExpiresAt = null;
    }
    if (customer.authProvider === "local") {
      customer.authProvider = "both";
    } else if (!customer.authProvider) {
      customer.authProvider = "google";
    }
    if (!customer.name && payload.name) {
      customer.name = payload.name;
    }
    await customer.save();
  } else {
    customer = await Customer.create({
      name: (payload.name || email.split("@")[0] || "Customer").trim(),
      email,
      googleId,
      emailVerified: true,
      authProvider: "google",
      status: "active",
    });
  }

  const token = generateCustomerToken(customer._id.toString());
  return success(res, {
    token,
    customer: shapeCustomer(customer),
  });
});
