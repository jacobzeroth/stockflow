import { headers } from "next/headers";
import { one, query } from "./db";

// Throttle failed sign-ins inside the database so the limit is shared by every
// serverless instance instead of resetting per lambda.
const WINDOW_SQL = "now() - interval '15 minutes'";
const MAX_PER_EMAIL = 20;
const MAX_PER_IP = 100;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const raw = (forwarded?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  return raw.slice(0, 64) || "unknown";
}

export async function tooManyAttempts(email: string, ip: string): Promise<boolean> {
  const row = await one<{ email_fails: string; ip_fails: string }>(
    `select
       (select count(*) from login_attempts
         where lower(email) = lower($1) and created_at > ${WINDOW_SQL})::text as email_fails,
       (select count(*) from login_attempts
         where ip = $2 and created_at > ${WINDOW_SQL})::text as ip_fails`,
    [email.slice(0, 254), ip]
  );
  return (
    Number(row?.email_fails ?? 0) >= MAX_PER_EMAIL ||
    Number(row?.ip_fails ?? 0) >= MAX_PER_IP
  );
}

export async function recordFailure(email: string, ip: string): Promise<void> {
  await query("insert into login_attempts (id, email, ip) values ($1,$2,$3)", [
    crypto.randomUUID(),
    email.slice(0, 254),
    ip,
  ]);
  await query("delete from login_attempts where created_at < now() - interval '7 days'");
}

export async function clearFailures(email: string): Promise<void> {
  await query("delete from login_attempts where lower(email) = lower($1)", [
    email.slice(0, 254),
  ]);
}
