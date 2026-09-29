/** Cart request validation — mirrors backend/schemas/cart_schema.py. */
import { z } from "zod";

export const addToCartSchema = z.object({
  product_id: z.string(),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const updateCartSchema = z.object({
  product_id: z.string(),
  quantity: z.number().int().min(0).max(99),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartInput = z.infer<typeof updateCartSchema>;
