/**
 * Auth guard — Fastify preHandler that validates the Bearer token and attaches
 * the decoded payload to request.user. Mirrors middleware/auth_middleware.py.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, type TokenPayload } from "./jwt.js";
import { unauthorized } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function requireAuth(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("Not authenticated");
  }
  const token = header.slice("Bearer ".length).trim();
  req.user = verifyToken(token);
}

/** Convenience accessor — the authenticated user id (JWT `sub`). */
export function userId(req: FastifyRequest): string {
  if (!req.user) throw unauthorized("Not authenticated");
  return req.user.sub;
}
