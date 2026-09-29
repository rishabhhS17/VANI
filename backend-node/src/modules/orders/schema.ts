/** Order request validation — mirrors backend/schemas/order_schema.py. */
import { z } from "zod";

export const shippingAddressSchema = z.object({
  name: z.string().min(2),
  street: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().min(4).max(10),
  phone: z.string().min(10).max(15),
});

export const createOrderSchema = z.object({
  shipping_address: shippingAddressSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
