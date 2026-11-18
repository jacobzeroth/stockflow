import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, newId, query, tx } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { Role, User } from "./types";

const COOKIE = "sf_session";
const SESSION_DAYS = 30;

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
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  await query("delete from sessions where expires_at < now()");
}

export async function rotateSession(userId: string): Promise<void> {
  await query("delete from sessions where user_id = $1", [userId]);
  await createSession(userId);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  }
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
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

export async function createFirstOwner(input: NewUser): Promise<string | null> {
  return tx(async (client) => {
    // Serialise signup so two simultaneous requests cannot both become the owner.
    await client.query("select pg_advisory_xact_lock($1)", [918273646]);
    const result = await client.query<{ count: string }>(
      "select count(*)::text as count from users"
    );
    if (Number(result.rows[0]?.count ?? 0) > 0) return null;

    const id = newId();
    await client.query(
      "insert into users (id, email, name, password_hash, role) values ($1,$2,$3,$4,$5)",
      [id, input.email.toLowerCase(), input.name, hashPassword(input.password), input.role]
    );
    return id;
  });
}
