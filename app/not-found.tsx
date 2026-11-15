import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-sm p-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">404</p>
        <h1 className="mt-2 text-lg font-semibold text-white">That record does not exist</h1>
        <p className="mt-1 text-sm text-muted">
          The product may have been removed, or the link is out of date.
        </p>
        <Link href="/products" className="btn-primary mt-5">
          Back to products
        </Link>
      </div>
    </main>
  );
}
