import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/actions/auth";
import { getCurrentUser, userCount } from "@/lib/auth";
import { Flash } from "@/components/ui";
import { LogoLockup } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  if ((await userCount()) > 0) redirect("/login");

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <LogoLockup gradientId="sf-logo-signup" />
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-white">Create the owner account</h1>
          <p className="mt-1 text-sm text-muted">
            This is the first account and gets full access. You can invite the rest of the
            team later from Settings.
          </p>

          <div className="mt-5">
            <Flash error={searchParams.error} />
          </div>

          <form action={signupAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input id="name" name="name" required className="input" placeholder="Jeevan P M" />
            </div>
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
                autoComplete="new-password"
                required
                minLength={10}
                className="input"
                placeholder="At least 10 characters, letters + numbers"
              />
            </div>
            <button className="btn-primary w-full" type="submit">
              Create workspace
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Already set up?{" "}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
