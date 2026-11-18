import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN, {
    ...SCRYPT,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  try {
    const computed = scryptSync(password, salt, hash.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    const expected = Buffer.from(hash, "hex");
    return computed.length === expected.length && timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain letters and numbers.";
  }
  if (password.length > 200) return "Password must be 200 characters or fewer.";
  return null;
}
