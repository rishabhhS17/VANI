/**
 * Fastify application factory — CORS, error handling, and route registration.
 * Mirrors backend/main.py (routers mounted under /api, env-driven CORS).
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import { allowedOrigins } from "./env.js";
import { AppError } from "./lib/errors.js";
import { pingDb } from "./db.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, ignoreTrailingSlash: true });

  await app.register(cors, {
    origin: allowedOrigins(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // ── Error handler — reproduce FastAPI's { detail } shape ──────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ detail: error.message });
    }
    // Zod validation failure → FastAPI 422 style: { detail: [{ msg }] }
    if (error instanceof ZodError) {
      return reply.status(422).send({
        detail: error.issues.map((i) => ({
          msg: i.message,
          loc: i.path,
          type: i.code,
        })),
      });
    }
    // Fastify's own validation errors
    if ((error as { validation?: unknown }).validation) {
      return reply.status(422).send({ detail: error.message });
    }
    // Other Fastify errors carry a 4xx statusCode (bad JSON body, empty body, etc.)
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ detail: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ detail: "Internal server error" });
  });

  // ── Health & root ─────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, reply) => {
    const dbOk = await pingDb();
    if (!dbOk) {
      return reply
        .status(503)
        .send({ status: "unhealthy", service: "VANI API", database: "down" });
    }
    return { status: "healthy", service: "VANI API", version: "1.0.0" };
  });

  app.get("/", async () => ({
    message:
      "Welcome to VANI API — Voice Assisted Navigation for Intelligent Commerce",
    docs: "/docs",
    health: "/api/health",
  }));

  // ── Feature routes (registered as modules are built) ──────────────────────
  const { authRoutes } = await import("./modules/auth/routes.js");
  const { productRoutes } = await import("./modules/products/routes.js");
  const { cartRoutes } = await import("./modules/cart/routes.js");
  const { orderRoutes } = await import("./modules/orders/routes.js");
  const { voiceRoutes } = await import("./modules/voice/routes.js");

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(productRoutes, { prefix: "/api/products" });
  await app.register(cartRoutes, { prefix: "/api/cart" });
  await app.register(orderRoutes, { prefix: "/api/orders" });
  await app.register(voiceRoutes, { prefix: "/api/voice" });

  return app;
}
