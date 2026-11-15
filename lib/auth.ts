import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, newId, query } from "./db";
import type { Role, User } from "./types";

const COOKIE = "sf_session";
const SESSION_DAYS = 30;
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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function userCount(): Promise<number> {
  const row = await one<{ count: string }>("select count(*)::text as count from users");
  return Number(row?.count ?? 0);
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    "insert into sessions (id, user_id, token_hash, expires_at) values ($1,$2,$3,$4)",
    [newId(), userId, hashToken(token), expires.toISOString()]
  );
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  await query("delete from sessions where expires_at < now()");
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  }
  cookies().delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const row = await one<User>(
    `select u.id, u.email, u.name, u.role, u.active, u.created_at
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()
        and u.active = true`,
    [hashToken(token)]
  );
  return row;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireWriter(): Promise<User> {
  const user = await requireUser();
  if (user.role === "viewer") redirect("/dashboard?error=Your+role+is+read-only");
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/dashboard?error=Owner+access+required");
  return user;
}

export type NewUser = {
  email: string;
  name: string;
  password: string;
  role: Role;
};

export async function insertUser(input: NewUser): Promise<string> {
  const id = newId();
  await query(
    "insert into users (id, email, name, password_hash, role) values ($1,$2,$3,$4,$5)",
    [
      id,
      input.email.toLowerCase(),
      input.name,
      hashPassword(input.password),
      input.role,
    ]
  );
  return id;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain letters and numbers.";
  }
  return null;
}
