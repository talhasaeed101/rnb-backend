import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";
import { slugify } from "../utils/slugify.js";

async function mapCategory(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const productCount = await Product.countDocuments({
    category: obj.name,
    status: { $ne: "inactive" },
  });
  return {
    id: String(obj._id),
    name: obj.name,
    slug: obj.slug,
    description: obj.description,
    image: obj.image,
    status: obj.status,
    productCount,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const listCategories = asyncHandler(async (_req, res) => {
  const items = await Category.find().sort({ name: 1 });
  const data = await Promise.all(items.map(mapCategory));
  return success(res, data);
});

export const getCategory = asyncHandler(async (req, res) => {
  const item = await Category.findById(req.params.id);
  if (!item) throw new AppError("Category not found", 404);
  return success(res, await mapCategory(item));
});

export const createCategory = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const slug = slugify(body.slug || body.name);
  const exists = await Category.findOne({ slug });
  if (exists) throw new AppError("Category slug already exists", 409);
  const item = await Category.create({
    name: body.name,
    slug,
    description: body.description || "",
    image: "",
    status: body.status || "active",
  });
  return success(res, await mapCategory(item), 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const item = await Category.findById(req.params.id);
  if (!item) throw new AppError("Category not found", 404);
  if (body.slug || body.name) {
    const slug = slugify(body.slug || body.name || item.slug);
    const clash = await Category.findOne({ slug, _id: { $ne: item._id } });
    if (clash) throw new AppError("Category slug already exists", 409);
    item.slug = slug;
  }
  if (body.name !== undefined) item.name = body.name;
  if (body.description !== undefined) item.description = body.description;
  if (body.status !== undefined) item.status = body.status;
  await item.save();
  return success(res, await mapCategory(item));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const item = await Category.findByIdAndDelete(req.params.id);
  if (!item) throw new AppError("Category not found", 404);
  return success(res, { id: String(item._id), deleted: true });
});
