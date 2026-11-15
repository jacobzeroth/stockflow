"use server";

import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  insertUser,
  passwordProblem,
  userCount,
  verifyPassword,
} from "@/lib/auth";
import { one } from "@/lib/db";

function back(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    back("/login", "Enter your email and password.");
  }

  const user = await one<{ id: string; password_hash: string; active: boolean }>(
    "select id, password_hash, active from users where email = $1",
    [email]
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    back("/login", "Email or password is incorrect.");
  }
  if (!user.active) {
    back("/login", "This account has been deactivated. Ask an owner to restore it.");
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signupAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if ((await userCount()) > 0) {
    back("/login", "This workspace already has an owner. Sign in, or ask for an invite.");
  }
  if (!name || name.length < 2) back("/signup", "Enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("/signup", "Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) back("/signup", problem);

  await insertUser({ name, email, password, role: "owner" });
  const user = await one<{ id: string }>("select id from users where email = $1", [email]);
  if (!user) back("/login", "Account could not be created. Try again.");
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
