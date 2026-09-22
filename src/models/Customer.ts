import mongoose, { Schema, type InferSchemaType } from "mongoose";

const addressSchema = new Schema(
  {
    name: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String,
  },
  { _id: false },
);

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    phone: { type: String, default: "" },
    passwordHash: { type: String, select: false, default: null },
    emailVerified: { type: Boolean, default: false, index: true },
    verificationOtpHash: { type: String, select: false, default: null },
    verificationOtpExpiresAt: { type: Date, select: false, default: null },
    resetOtpHash: { type: String, select: false, default: null },
    resetOtpExpiresAt: { type: Date, select: false, default: null },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetTokenExpiresAt: { type: Date, select: false, default: null },
    googleId: { type: String, select: false, default: null, index: true },
    authProvider: {
      type: String,
      enum: ["local", "google", "both"],
      default: "local",
    },
    addresses: { type: [addressSchema], default: [] },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

export type CustomerDocument = InferSchemaType<typeof customerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Customer =
  mongoose.models.Customer || mongoose.model("Customer", customerSchema);
