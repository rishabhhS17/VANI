/** Cart service — get/add/update/remove. Mirrors services/cart_service.py. */
import { prisma } from "../../db.js";
import { notFound } from "../../lib/errors.js";
import {
  round2,
  type CartWire,
  type CartItemWire,
} from "../../lib/serialize.js";

const EMPTY_CART: CartWire = { items: [], total: 0.0, item_count: 0 };

export async function getCart(userId: string): Promise<CartWire> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) return EMPTY_CART;

  const items: CartItemWire[] = [];
  let total = 0;
  for (const item of cart.items) {
    const p = item.product;
    if (!p) continue; // FK guarantees presence, but keep parity with Python
    const subtotal = p.price * item.quantity;
    total += subtotal;
    items.push({
      product_id: p.id,
      name: p.name,
      brand: p.brand,
      image: p.image,
      price: p.price,
      originalPrice: p.originalPrice ?? null,
      quantity: item.quantity,
      subtotal: round2(subtotal),
    });
  }

  return {
    items,
    total: round2(total),
    item_count: items.reduce((n, i) => n + i.quantity, 0),
  };
}

export async function addToCart(
  userId: string,
  productId: string,
  quantity = 1,
): Promise<CartWire> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound(`Product not found: ${productId}`);

  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: { increment: quantity } },
  });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  return getCart(userId);
}

export async function updateCartQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartWire> {
  if (quantity === 0) return removeFromCart(userId, productId);

  const cart = await prisma.cart.findUnique({ where: { userId } });
  const item = cart
    ? await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      })
    : null;
  if (!cart || !item) throw notFound("Item not found in cart");

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity },
  });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  return getCart(userId);
}

export async function removeFromCart(
  userId: string,
  productId: string,
): Promise<CartWire> {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw notFound("Cart not found");

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  return getCart(userId);
}
