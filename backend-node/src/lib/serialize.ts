/**
 * DTO mappers: Prisma models (camelCase) -> EXACT HTTP wire shapes.
 *
 * The existing wire format is intentionally inconsistently cased (products use
 * `originalPrice`/`all_images`, cart uses `product_id`/`item_count`). The
 * frontend depends on these exact names, so do NOT "normalize" them here.
 * Source of truth: backend/schemas/*.py + frontend/src/api/client.ts.
 */
import type { Product, OrderItem, Order, User } from "@prisma/client";

export interface ProductWire {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  all_images: string[];
  rating: number;
  reviews: number;
  price: number;
  originalPrice: number | null;
  about: string;
  description: string;
  rating_distribution: Record<string, unknown>;
  customer_reviews: unknown[];
}

export function toProductWire(p: Product): ProductWire {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: p.image,
    all_images: (p.allImages as string[]) ?? [],
    rating: p.rating,
    reviews: p.reviews,
    price: p.price,
    originalPrice: p.originalPrice ?? null,
    about: p.about,
    description: p.description,
    rating_distribution: (p.ratingDistribution as Record<string, unknown>) ?? {},
    customer_reviews: (p.customerReviews as unknown[]) ?? [],
  };
}

export interface CartItemWire {
  product_id: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  originalPrice: number | null;
  quantity: number;
  subtotal: number;
}

export interface CartWire {
  items: CartItemWire[];
  total: number;
  item_count: number;
}

export interface OrderItemWire {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export function toOrderItemWire(i: OrderItem): OrderItemWire {
  return {
    product_id: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    image: i.image,
  };
}

export interface OrderWire {
  id: string;
  items: OrderItemWire[];
  total: number;
  status: string;
  shipping_address: Record<string, unknown>;
  created_at: string;
}

export function toOrderWire(o: Order & { items: OrderItem[] }): OrderWire {
  return {
    id: o.id,
    items: o.items.map(toOrderItemWire),
    total: o.total,
    status: o.status,
    shipping_address: (o.shippingAddress as Record<string, unknown>) ?? {},
    created_at: o.createdAt.toISOString(),
  };
}

export interface UserWire {
  id: string;
  name: string;
  email: string;
}

export function toUserWire(u: Pick<User, "id" | "name" | "email">): UserWire {
  return { id: u.id, name: u.name, email: u.email };
}

export interface AuthWire {
  access_token: string;
  token_type: "bearer";
  user: UserWire;
}

/** round to 2 decimals, matching Python's round(x, 2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
