/** Auth routes — /api/auth. Mirrors backend/routes/auth_routes.py. */
import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "./schema.js";
import { registerUser, loginUser, getUserProfile } from "./service.js";
import { requireAuth, userId } from "../../auth/guard.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    return reply.status(201).send(result);
  });

  app.post("/login", async (req) => {
    const input = loginSchema.parse(req.body);
    return loginUser(input);
  });

  app.get("/me", { preHandler: requireAuth }, async (req) => {
    return getUserProfile(userId(req));
  });
}
