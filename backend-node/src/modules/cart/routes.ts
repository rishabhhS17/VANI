/** Cart routes — /api/cart. Mirrors backend/routes/cart_routes.py. */
import type { FastifyInstance } from "fastify";
import { addToCartSchema, updateCartSchema } from "./schema.js";
import {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
} from "./service.js";
import { requireAuth, userId } from "../../auth/guard.js";

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (req) => getCart(userId(req)));

  app.post("/add", async (req) => {
    const input = addToCartSchema.parse(req.body);
    return addToCart(userId(req), input.product_id, input.quantity);
  });

  app.put("/update", async (req) => {
    const input = updateCartSchema.parse(req.body);
    return updateCartQuantity(userId(req), input.product_id, input.quantity);
  });

  app.delete("/:productId", async (req) => {
    const { productId } = req.params as { productId: string };
    return removeFromCart(userId(req), productId);
  });
}
