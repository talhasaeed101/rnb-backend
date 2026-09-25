import { z } from "zod";

export const categoryBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  parentId: z.string().nullable().optional(),
  children: z.array(z.string().min(1)).optional(),
  createChildren: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryBodySchema.partial();
