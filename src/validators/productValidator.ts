import { z } from "zod";

const imageSchema = z.object({
  url: z.string().url(),
  publicId: z.string().optional().default(""),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  format: z.string().optional(),
  bytes: z.number().optional(),
});

const videoSchema = z
  .object({
    url: z.string().url(),
    publicId: z.string().optional().default(""),
    duration: z.number().nullable().optional(),
    format: z.string().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const variationSchema = z.object({
  name: z.string().min(1),
  options: z.array(z.string()).default([]),
});

export const productBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  price: z.number().min(0),
  salePrice: z.number().min(0).nullable().optional(),
  description: z.string().optional().default(""),
  category: z.string().min(1),
  collection: z.string().optional().default(""),
  images: z.array(imageSchema).optional().default([]),
  video: videoSchema,
  badge: z.string().nullable().optional(),
  material: z.string().optional().default(""),
  care: z.string().optional().default(""),
  warranty: z.string().optional().default(""),
  sku: z.string().optional().default(""),
  stock: z.number().int().min(0).optional().default(0),
  status: z.enum(["active", "inactive", "draft"]).optional().default("draft"),
  variations: z.array(variationSchema).optional().default([]),
  sizes: z.array(z.string()).optional().default([]),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional().default(""),
  category: z.string().optional().default(""),
  collection: z.string().optional().default(""),
  status: z.string().optional().default(""),
  sort: z.string().optional().default("-createdAt"),
});
