import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, stockStatus } from "@/lib/types";
import type { Product, StockStatus } from "@/lib/types";
import { CURRENCY } from "@/lib/config";

export function money(value: number, currency = CURRENCY): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function number(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function when(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function day(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
        error
          ? "border-[#5c2a30] bg-[#241014] text-[#ffb3b3]"
          : "border-[#1d4d3b] bg-[#0d241c] text-[#8de8c2]"
      }`}
      role={error ? "alert" : "status"}
    >
      {error ?? ok}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad" | "brand";
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    ok: "text-ok",
    warn: "text-warn",
    bad: "text-bad",
    brand: "text-[#7b9bff]",
  };
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ product }: { product: Pick<Product, "on_hand" | "reorder_level"> }) {
  const status: StockStatus = stockStatus(product);
  const styles: Record<StockStatus, string> = {
    out: "border-[#5c2a30] bg-[#241014] text-[#ff9c9c]",
    low: "border-[#5a481f] bg-[#241f0e] text-[#f6ce74]",
    ok: "border-[#1d4d3b] bg-[#0d241c] text-[#7fe0bb]",
  };
  return <span className={`pill ${styles[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    in: "border-[#1d4d3b] bg-[#0d241c] text-[#7fe0bb]",
    out: "border-[#3a3f57] bg-[#151a2a] text-[#a9b6ff]",
    adjust: "border-[#5a481f] bg-[#241f0e] text-[#f6ce74]",
  };
  const label: Record<string, string> = { in: "Received", out: "Issued", adjust: "Adjusted" };
  return <span className={`pill ${map[kind] ?? map.out}`}>{label[kind] ?? kind}</span>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action ? (
        <Link href={action.href} className="btn-primary mt-4">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Qty({ value }: { value: number }) {
  const tone = value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-muted";
  return (
    <span className={`tabular-nums ${tone}`}>
      {value > 0 ? "+" : ""}
      {number(value)}
    </span>
  );
}
