import mongoose, { Schema, type InferSchemaType } from "mongoose";

const mediaImageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false },
);

const mediaVideoSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    duration: { type: Number },
    format: { type: String },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

const variationSchema = new Schema(
  {
    name: { type: String, required: true },
    options: { type: [String], default: [] },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    description: { type: String, default: "" },
    category: { type: String, required: true, index: true },
    collection: { type: String, default: "", index: true },
    images: { type: [mediaImageSchema], default: [] },
    video: { type: mediaVideoSchema, default: null },
    badge: { type: String, default: null },
    material: { type: String, default: "" },
    care: { type: String, default: "" },
    warranty: { type: String, default: "" },
    sku: { type: String, default: "", index: true },
    stock: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "draft",
      index: true,
    },
    variations: { type: [variationSchema], default: [] },
    sizes: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type ProductDocument = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
