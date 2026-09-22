import { z } from "zod";

export const promoBodySchema = z.object({
  code: z.string().min(2),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().min(0),
  minimumOrder: z.number().min(0).optional().default(0),
  maximumDiscount: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().min(0).optional().default(0),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  status: z.enum(["active", "inactive", "expired"]).optional().default("active"),
});

export const promoValidateSchema = z.object({
  code: z.string().min(1),
  orderTotal: z.number().min(0).optional().default(0),
});
