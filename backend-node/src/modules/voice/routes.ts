/** Voice routes — /api/voice. Mirrors backend/routes/voice_routes.py.
 *  Adds a per-user rate limit (this endpoint spends money on Groq). */
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { voiceCommandSchema } from "./schema.js";
import { parseIntent } from "./intentParser.js";
import { dispatchIntent } from "./dispatcher.js";
import { getVoiceAnalytics } from "./analytics.js";
import { requireAuth, userId } from "../../auth/guard.js";

export async function voiceRoutes(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 30,
    timeWindow: "1 minute",
    keyGenerator: (req) => (req.headers.authorization as string) || req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      detail: "Rate limit exceeded. Please slow down.",
    }),
  });

  app.addHook("preHandler", requireAuth);

  app.post("/command", async (req) => {
    const { command } = voiceCommandSchema.parse(req.body);
    const parsed = await parseIntent(command);
    return dispatchIntent(parsed, userId(req), command);
  });

  app.get("/analytics", async (req) => getVoiceAnalytics(userId(req)));
}
