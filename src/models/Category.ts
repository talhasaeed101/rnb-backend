import mongoose, { Schema, type InferSchemaType } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

categorySchema.index({ parentId: 1, name: 1 });

export type CategoryDocument = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
