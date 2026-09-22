import { z } from "zod";

const addressSchema = z.object({
  name: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
});

const itemSchema = z.object({
  product: z.string().optional(),
  name: z.string().min(1),
  image: z.string().optional().default(""),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  variation: z.string().optional().default(""),
  size: z.string().optional().default(""),
});

export const orderBodySchema = z.object({
  customer: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  items: z.array(itemSchema).min(1),
  subtotal: z.number().min(0),
  discount: z.number().min(0).optional().default(0),
  shipping: z.number().min(0).optional().default(0),
  total: z.number().min(0),
  paymentStatus: z
    .enum(["pending", "paid", "failed", "refunded"])
    .optional()
    .default("pending"),
  orderStatus: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "dispatched",
      "delivered",
      "cancelled",
    ])
    .optional()
    .default("pending"),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  notes: z.string().optional().default(""),
});

export const orderStatusSchema = z.object({
  orderStatus: z.enum([
    "pending",
    "confirmed",
    "processing",
    "dispatched",
    "delivered",
    "cancelled",
  ]),
});

export const dispatchSchema = z.object({
  courier: z.string().min(1),
  trackingNumber: z.string().min(1),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional().default(""),
  status: z.string().optional().default(""),
  payment: z.string().optional().default(""),
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
});
