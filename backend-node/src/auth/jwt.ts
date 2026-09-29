/** JWT creation/verification — HS256, mirrors backend/utils/jwt_handler.py. */
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { unauthorized } from "../lib/errors.js";

export interface TokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function createAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: `${env.JWT_EXPIRY_HOURS}h`,
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as TokenPayload;
    if (!payload.sub) {
      throw unauthorized("Invalid token: missing subject");
    }
    return payload;
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) throw err;
    throw unauthorized(`Invalid or expired token: ${(err as Error).message}`);
  }
}
