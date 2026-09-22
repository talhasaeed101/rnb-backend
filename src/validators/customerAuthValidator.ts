import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().email(),
    password: passwordSchema,
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.confirmPassword !== undefined &&
      data.confirmPassword !== data.password
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const emailOnlySchema = z.object({
  email: z.string().trim().email(),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

export const verifyResetOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().trim().min(20, "Reset token is required"),
    password: passwordSchema,
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.confirmPassword !== undefined &&
      data.confirmPassword !== data.password
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const googleAuthSchema = z.object({
  credential: z.string().min(10, "Google credential is required"),
});
