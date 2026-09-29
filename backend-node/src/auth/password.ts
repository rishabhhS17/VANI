/** Password hashing — argon2 (fresh DB, no legacy bcrypt hashes to verify). */
import argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}
