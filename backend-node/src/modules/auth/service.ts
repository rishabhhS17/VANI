/** Auth service — register/login/profile. Mirrors services/auth_service.py. */
import { prisma } from "../../db.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { createAccessToken } from "../../auth/jwt.js";
import { conflict, unauthorized, notFound } from "../../lib/errors.js";
import { toUserWire, type AuthWire, type UserWire } from "../../lib/serialize.js";
import type { RegisterInput, LoginInput } from "./schema.js";

export async function registerUser(input: RegisterInput): Promise<AuthWire> {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw conflict("A user with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { name: input.name, email, passwordHash },
  });

  return {
    access_token: createAccessToken(user.id, user.email),
    token_type: "bearer",
    user: toUserWire(user),
  };
}

export async function loginUser(input: LoginInput): Promise<AuthWire> {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized("Invalid email or password");

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid email or password");

  return {
    access_token: createAccessToken(user.id, user.email),
    token_type: "bearer",
    user: toUserWire(user),
  };
}

export async function getUserProfile(id: string): Promise<UserWire> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("User not found");
  return toUserWire(user);
}
