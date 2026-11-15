import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser, userCount } from "@/lib/auth";
import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const fresh = (await userCount()) === 0;

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-sm font-bold text-white">
            Z
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight text-white">StockFlow</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
              Zeroth inventory control
            </p>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-white">
            {fresh ? "Create your workspace" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {fresh
              ? "No account exists yet. Set up the owner account to begin."
              : "Use the email and password for your team account."}
          </p>

          <div className="mt-5">
            <Flash error={searchParams.error} />
          </div>

          {fresh ? (
            <Link href="/signup" className="btn-primary w-full">
              Set up owner account
            </Link>
          ) : (
            <form action={loginAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  className="input"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input"
                  placeholder="••••••••••"
                />
              </div>
              <button className="btn-primary w-full" type="submit">
                Sign in
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Sessions expire after 30 days. Passwords are hashed with scrypt.
        </p>
      </div>
    </main>
  );
}
