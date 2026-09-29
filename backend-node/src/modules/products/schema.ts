/** Product query validation — mirrors backend/schemas/product_schema.py. */
import { z } from "zod";

const sortBy = z
  .enum(["price_asc", "price_desc", "rating", "newest", "reviews"])
  .optional();

export const listQuerySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  rating_min: z.coerce.number().min(0).max(5).optional(),
  sort_by: sortBy,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuerySchema = listQuerySchema.extend({
  q: z.string().min(1),
  color: z.string().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
