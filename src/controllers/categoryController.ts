import { Category } from "../models/Category.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";
import {
  mapCategory,
  syncCategoryCatalog,
  updateCategoryById,
  upsertCategory,
} from "../services/categoryService.js";

export const listCategories = asyncHandler(async (_req, res) => {
  const items = await Category.find().sort({ parentId: 1, sortOrder: 1, name: 1 });
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
  const { item, created } = await upsertCategory({
    name: body.name,
    slug: body.slug,
    description: body.description,
    image: body.image,
    status: body.status,
    parentId: body.parentId ?? null,
    children: body.children,
    createChildren: body.createChildren,
  });
  return success(res, await mapCategory(item), created ? 201 : 200);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const saved = await updateCategoryById(String(req.params.id), {
    name: body.name,
    slug: body.slug,
    description: body.description,
    image: body.image,
    status: body.status,
    parentId: body.parentId,
    children: body.children,
    createChildren: body.createChildren,
  });
  return success(res, await mapCategory(saved));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const item = await Category.findById(req.params.id);
  if (!item) throw new AppError("Category not found", 404);
  const childCount = await Category.countDocuments({ parentId: item._id });
  if (childCount > 0) {
    throw new AppError("Delete subcategories first before deleting this category", 409);
  }
  await Category.findByIdAndDelete(item._id);
  return success(res, { id: String(item._id), deleted: true });
});

export const syncCatalog = asyncHandler(async (_req, res) => {
  const results = await syncCategoryCatalog();
  return success(res, results);
});
