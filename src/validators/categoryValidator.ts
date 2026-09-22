import { z } from "zod";

export const categoryBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional().default(""),
  image: z.string().optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});
