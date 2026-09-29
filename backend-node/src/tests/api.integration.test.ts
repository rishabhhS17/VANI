/**
 * Integration tests for the money paths (auth -> cart -> checkout) and voice.
 * Requires a running, seeded Postgres (DATABASE_URL). Uses Fastify's inject.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";

let app: FastifyInstance;
let token: string;
let firstProductId: string;

const email = `test_${Date.now()}@example.com`;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("auth", () => {
  it("registers a new user and returns a bearer token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Test User", email, password: "secret123" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token_type).toBe("bearer");
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe(email);
    token = body.access_token;
  });

  it("rejects a duplicate email with 409 and { detail }", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Test User", email, password: "secret123" },
    });
    expect(res.statusCode).toBe(409);
    expect(typeof res.json().detail).toBe("string");
  });

  it("rejects /me without a token (401)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});

describe("products", () => {
  it("lists products with correct wire shape", async () => {
    const res = await app.inject({ method: "GET", url: "/api/products?limit=5" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("total_pages");
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);
    const p = body.products[0];
    expect(p).toHaveProperty("all_images");
    expect(p).toHaveProperty("originalPrice");
    expect(p).toHaveProperty("rating_distribution");
    firstProductId = p.id;
  });

  it("full-text search returns results for a common term", async () => {
    const res = await app.inject({ method: "GET", url: "/api/products/search?q=shirt" });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBeGreaterThan(0);
  });
});

describe("cart + checkout (atomic)", () => {
  it("adds an item, then checkout clears the cart", async () => {
    const auth = { authorization: `Bearer ${token}` };

    const add = await app.inject({
      method: "POST",
      url: "/api/cart/add",
      headers: auth,
      payload: { product_id: firstProductId, quantity: 2 },
    });
    expect(add.statusCode).toBe(200);
    expect(add.json().item_count).toBe(2);

    const order = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: auth,
      payload: {
        shipping_address: {
          name: "Test User",
          street: "123 Main Street",
          city: "Metropolis",
          state: "State",
          pincode: "12345",
          phone: "1234567890",
        },
      },
    });
    expect(order.statusCode).toBe(201);
    const ob = order.json();
    expect(ob.items.length).toBe(1);
    expect(ob).toHaveProperty("created_at");

    // Cart must be empty after checkout.
    const cart = await app.inject({ method: "GET", url: "/api/cart", headers: auth });
    expect(cart.json().item_count).toBe(0);
  });
});

describe("voice", () => {
  it("processes a rule-parsed search command", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/voice/command",
      headers: { authorization: `Bearer ${token}` },
      payload: { command: "show me jeans" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.action).toBe("search_products");
    expect(body.intent.parser_used).toBe("rule");
    expect(body.success).toBe(true);
  });
});
