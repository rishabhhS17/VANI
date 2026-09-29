/**
 * Environment validation — fails fast at boot if required vars are missing.
 * Deliberately NO insecure fallback for JWT_SECRET (the Python version had one).
 */
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRY_HOURS: z.coerce.number().int().positive().default(24),
  GROQ_API_KEY: z.string().default(""),
  ALLOWED_ORIGINS: z.string().default(""),
  PORT: z.coerce.number().int().positive().default(8001),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`[FATAL] Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

/** Default dev CORS origins, always allowed, matching the Python backend. */
export const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

export function allowedOrigins(): string[] {
  const extra = env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ORIGINS, ...extra]));
}
