import type { Request } from "express";
import { Product } from "../models/Product.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";
import { slugify } from "../utils/slugify.js";

function mapProduct(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    name: obj.name,
    slug: obj.slug,
    price: obj.price,
    salePrice: obj.salePrice ?? null,
    description: obj.description,
    category: obj.category,
    collection: obj.collection,
    images: (obj.images || []).map((img: any, index: number) => ({
      id: img.publicId || `img-${index}`,
      url: img.url,
      publicId: img.publicId || "",
      width: img.width,
      height: img.height,
      format: img.format,
      bytes: img.bytes,
      alt: obj.name,
      isMain: index === 0,
      sortOrder: index,
    })),
    video: obj.video || null,
    badge: obj.badge ?? null,
    material: obj.material,
    care: obj.care,
    warranty: obj.warranty,
    sku: obj.sku,
    stock: obj.stock,
    status: obj.status,
    variations: (obj.variations || []).map((v: any, i: number) => ({
      id: `var-${i}`,
      name: v.name,
      values: v.options || [],
      options: v.options || [],
    })),
    sizes: obj.sizes || [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const listProducts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const search = String(req.query.search || "");
  const category = String(req.query.category || "");
  const collection = String(req.query.collection || "");
  const status = String(req.query.status || "");
  const sort = String(req.query.sort || "-createdAt");

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }
  if (category) filter.category = category;
  if (collection) filter.collection = collection;
  if (status) filter.status = status;

  const total = await Product.countDocuments(filter);
  const items = await Product.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  return success(res, items.map(mapProduct), 200, {
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) throw new AppError("Product not found", 404);
  return success(res, mapProduct(product));
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found", 404);
  return success(res, mapProduct(product));
});

export const createProduct = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const slug = slugify(body.slug || body.name);
  const exists = await Product.findOne({ slug });
  if (exists) throw new AppError("Product slug already exists", 409);

  const variations = (body.variations || []).map((v: any) => ({
    name: v.name,
    options: v.options || v.values || [],
  }));

  const product = await Product.create({
    ...body,
    slug,
    variations,
    salePrice: body.salePrice ?? null,
  });

  return success(res, mapProduct(product), 201);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found", 404);

  if (body.slug || body.name) {
    const slug = slugify(body.slug || body.name || product.slug);
    const clash = await Product.findOne({ slug, _id: { $ne: product._id } });
    if (clash) throw new AppError("Product slug already exists", 409);
    product.slug = slug;
  }

  const fields = [
    "name",
    "price",
    "salePrice",
    "description",
    "category",
    "collection",
    "images",
    "video",
    "badge",
    "material",
    "care",
    "warranty",
    "sku",
    "stock",
    "status",
    "sizes",
  ] as const;

  for (const key of fields) {
    if (body[key] !== undefined) {
      (product as any)[key] = body[key];
    }
  }

  if (body.variations) {
    product.variations = body.variations.map((v: any) => ({
      name: v.name,
      options: v.options || v.values || [],
    }));
  }

  await product.save();
  return success(res, mapProduct(product));
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found", 404);
  product.status = "inactive";
  await product.save();
  return success(res, mapProduct(product));
});
