import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";
import {
  CardHeader,
  EmptyState,
  Flash,
  KindBadge,
  PageHeader,
  Qty,
  Stat,
  StatusBadge,
  money,
  number,
  when,
} from "@/components/ui";
import { stockStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const [data, workspace] = await Promise.all([getDashboard(), getWorkspace()]);
  const currency = workspace.currency;
  const lowCount = data.products.filter((p) => stockStatus(p) !== "ok").length;
  const maxCategory = Math.max(...data.categories.map((c) => c.value), 1);

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        subtitle={`Stock position as of ${new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
      >
        {user.role !== "viewer" ? (
          <>
            <Link href="/movements" className="btn-ghost">
              Add stock
            </Link>
            <Link href="/products/new" className="btn-primary">
              New product
            </Link>
          </>
        ) : null}
      </PageHeader>

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active SKUs"
          value={number(data.products.length)}
          hint={`${number(data.unitsOnHand)} units on hand`}
        />
        <Stat
          label="Stock value (cost)"
          value={money(data.stockValue, currency)}
          hint={`${money(data.retailValue, currency)} at selling price`}
          tone="brand"
        />
        <Stat
          label="Needs attention"
          value={number(lowCount)}
          hint={`${data.outOfStock} out of stock`}
          tone={data.outOfStock > 0 ? "bad" : lowCount > 0 ? "warn" : "ok"}
        />
        <Stat
          label="Movements this month"
          value={number(data.movementsThisMonth)}
          hint="Receipts, issues and counts"
        />
      </div>

      {data.products.length === 0 ? (
        <div className="card mt-5">
          <EmptyState
            title="Your catalogue is empty"
            body="Add your first product, or load a sample catalogue to see how StockFlow works. Sample data is fully editable and can be deleted later."
            action={{ href: "/products/new", label: "Add a product" }}
          />
          <div className="flex justify-center border-t border-line px-6 py-4">
            <Link href="/settings" className="btn-ghost btn-sm">
              Load sample catalogue from Settings
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <div className="card xl:col-span-2">
            <CardHeader
              title="Reorder watchlist"
              hint={lowCount ? `${lowCount} product(s) at or below reorder level` : "All levels healthy"}
            />
            {data.lowStock.length === 0 ? (
              <EmptyState
                title="Everything is above its reorder level"
                body="StockFlow will flag products here as soon as on-hand quantity drops to the threshold you set."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="th">Product</th>
                      <th className="th text-right">On hand</th>
                      <th className="th text-right">Reorder at</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.slice(0, 6).map((product) => (
                      <tr key={product.id} className="row-hover border-b border-line/60 last:border-0">
                        <td className="td">
                          <Link href={`/products/${product.id}`} className="font-medium text-white hover:text-[#9db4ff]">
                            {product.name}
                          </Link>
                          <p className="font-mono text-[11px] text-muted">{product.sku}</p>
                        </td>
                        <td className="td text-right tabular-nums">{number(product.on_hand)}</td>
                        <td className="td text-right tabular-nums text-muted">
                          {number(product.reorder_level)}
                        </td>
                        <td className="td">
                          <StatusBadge product={product} />
                        </td>
                        <td className="td text-right">
                          <Link href={`/movements?product=${product.id}`} className="btn-ghost btn-sm">
                            Receive
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.lowStock.length > 0 ? (
              <div className="border-t border-line px-4 py-3 text-right">
                <Link href="/reorder" className="text-xs font-semibold text-[#9db4ff] hover:underline">
                  Build a purchase order →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="card">
            <CardHeader title="Stock value by category" hint="At cost" />
            <div className="space-y-3 p-4">
              {data.categories.length === 0 ? (
                <p className="text-sm text-muted">No data yet.</p>
              ) : (
                data.categories.map((category) => (
                  <div key={category.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-silver">{category.name}</span>
                      <span className="shrink-0 tabular-nums text-muted">{money(category.value, currency)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.max((category.value / maxCategory) * 100, 2)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{number(category.units)} units</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card mt-5">
        <CardHeader title="Recent movement" hint="Latest 8 entries" />
        {data.recent.length === 0 ? (
          <EmptyState
            title="No movements recorded"
            body="Every receipt, issue and stock count is written to an append-only ledger, giving you a full audit trail."
            action={{ href: "/movements", label: "Record the first movement" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">When</th>
                  <th className="th">Product</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Change</th>
                  <th className="th">Reason</th>
                  <th className="th">By</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((movement) => (
                  <tr key={movement.id} className="row-hover border-b border-line/60 last:border-0">
                    <td className="td whitespace-nowrap text-muted">{when(movement.created_at)}</td>
                    <td className="td">
                      <Link href={`/products/${movement.product_id}`} className="text-white hover:text-[#9db4ff]">
                        {movement.product_name}
                      </Link>
                    </td>
                    <td className="td">
                      <KindBadge kind={movement.kind} />
                    </td>
                    <td className="td text-right">
                      <Qty value={movement.quantity} />
                    </td>
                    <td className="td text-muted">{movement.reason ?? "—"}</td>
                    <td className="td text-muted">{movement.created_by_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
