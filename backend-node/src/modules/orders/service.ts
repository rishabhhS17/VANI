/**
 * Order service — create (atomic), history, detail.
 * Mirrors services/order_service.py, with two fixes folded in:
 *  - order creation + cart clear run inside a single prisma.$transaction
 *  - optional idempotency key prevents duplicate orders on resubmit
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { round2, toOrderWire, type OrderWire } from "../../lib/serialize.js";

export interface OrderListResult {
  orders: OrderWire[];
  total: number;
}

const withItems = { items: true } as const;

export async function createOrder(
  userId: string,
  shippingAddress: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<OrderWire> {
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: withItems,
    });
    if (existing) return toOrderWire(existing);
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });
      if (!cart || cart.items.length === 0) {
        throw badRequest("Cart is empty. Add items before placing an order.");
      }

      const orderItems = cart.items
        .filter((i) => i.product)
        .map((i) => ({
          productId: i.productId,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
          image: i.product.image,
        }));
      if (orderItems.length === 0) {
        throw badRequest("No valid products found in cart");
      }

      const total = orderItems.reduce((t, i) => t + i.price * i.quantity, 0);

      const created = await tx.order.create({
        data: {
          userId,
          total: round2(total),
          shippingAddress: shippingAddress as Prisma.InputJsonValue,
          idempotencyKey: idempotencyKey ?? null,
          items: { create: orderItems },
        },
        include: withItems,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });

    return toOrderWire(order);
  } catch (err) {
    // Concurrent request with the same idempotency key won the race.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      idempotencyKey
    ) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: withItems,
      });
      if (existing) return toOrderWire(existing);
    }
    throw err;
  }
}

export async function getOrders(userId: string): Promise<OrderListResult> {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: withItems,
    orderBy: { createdAt: "desc" },
  });
  return { orders: orders.map(toOrderWire), total: orders.length };
}

export async function getOrderById(
  userId: string,
  orderId: string,
): Promise<OrderWire> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: withItems,
  });
  if (!order) throw notFound("Order not found");
  return toOrderWire(order);
}
