import mongoose, { Schema, type InferSchemaType } from "mongoose";

const promoCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minimumOrder: { type: Number, default: 0 },
    maximumDiscount: { type: Number, default: null },
    usageLimit: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

export type PromoCodeDocument = InferSchemaType<typeof promoCodeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PromoCode =
  mongoose.models.PromoCode || mongoose.model("PromoCode", promoCodeSchema);
