"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const missingDb = /DATABASE_URL|No database configured/i.test(error.message);

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bad">
          {missingDb ? "Setup incomplete" : "Something broke"}
        </p>
        <h1 className="mt-2 text-lg font-semibold text-white">
          {missingDb ? "No database is connected" : "This page could not load"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {missingDb
            ? "StockFlow needs a Postgres connection string in DATABASE_URL. Connect a database in Vercel (Storage → Neon) and redeploy, or set DATABASE_URL locally."
            : "An unexpected error occurred. Try again; if it persists, share the reference below with the workspace owner."}
        </p>
        {!missingDb && error.digest ? (
          <p className="mt-3 text-[11px] text-muted">Reference: {error.digest}</p>
        ) : null}
        <button className="btn-primary mt-5" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
