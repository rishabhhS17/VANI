/** Order routes — /api/orders. Mirrors backend/routes/order_routes.py. */
import type { FastifyInstance } from "fastify";
import { createOrderSchema } from "./schema.js";
import { createOrder, getOrders, getOrderById } from "./service.js";
import { requireAuth, userId } from "../../auth/guard.js";

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.post("/", async (req, reply) => {
    const input = createOrderSchema.parse(req.body);
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const order = await createOrder(
      userId(req),
      input.shipping_address,
      idempotencyKey,
    );
    return reply.status(201).send(order);
  });

  app.get("/", async (req) => getOrders(userId(req)));

  app.get("/:orderId", async (req) => {
    const { orderId } = req.params as { orderId: string };
    return getOrderById(userId(req), orderId);
  });
}
