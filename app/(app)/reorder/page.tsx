import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getReorderGroups } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";
import { CardHeader, EmptyState, PageHeader, StatusBadge, money, number } from "@/components/ui";
import { CopyButton } from "@/components/reorder-actions";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

function orderText(
  supplier: string,
  items: { sku: string; name: string; suggested: number; unit: string }[]
): string {
  const lines = [
    `Purchase order request — ${supplier}`,
    `Date: ${new Date().toLocaleDateString("en-GB")}`,
    "",
    ...items.map(
      (item, index) => `${index + 1}. ${item.sku} — ${item.name} — ${item.suggested} ${item.unit}`
    ),
    "",
    "Please confirm availability and lead time.",
  ];
  return lines.join("\n");
}

export default async function ReorderPage() {
  await requireUser();
  const [groups, workspace] = await Promise.all([getReorderGroups(), getWorkspace()]);
  const currency = workspace.currency;
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const estimated = groups.reduce(
    (sum, group) =>
      sum + group.items.reduce((inner, item) => inner + item.suggested * item.product.unit_cost, 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Reorder"
        subtitle="Products at or below their reorder level, grouped by supplier"
      >
        <a href="/api/export/reorder" className="btn-ghost">
          Export CSV
        </a>
        <PrintButton />
      </PageHeader>

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Nothing to reorder"
            body="Every product is above its reorder level. Lower a threshold on a product, or receive more stock to keep it that way."
            action={{ href: "/products", label: "Review products" }}
          />
        </div>
      ) : (
        <>
          <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {number(totalItems)} line{totalItems === 1 ? "" : "s"} across {groups.length} supplier
                {groups.length === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted">
                Suggested quantities aim to bring each product back to twice its reorder level.
              </p>
            </div>
            <p className="text-sm text-muted">
              Estimated cost <span className="ml-1 font-semibold text-white">{money(estimated, currency)}</span>
            </p>
          </div>

          <div className="space-y-5">
            {groups.map((group) => {
              const groupTotal = group.items.reduce(
                (sum, item) => sum + item.suggested * item.product.unit_cost,
                0
              );
              const text = orderText(
                group.supplier.name,
                group.items.map((item) => ({
                  sku: item.product.sku,
                  name: item.product.name,
                  suggested: item.suggested,
                  unit: item.product.unit,
                }))
              );
              const mailto = group.supplier.email
                ? `mailto:${group.supplier.email}?subject=${encodeURIComponent(
                    `Stock reorder — ${group.supplier.name}`
                  )}&body=${encodeURIComponent(text)}`
                : null;

              return (
                <div className="card overflow-hidden" key={group.supplier.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white">{group.supplier.name}</h2>
                      <p className="text-xs text-muted">
                        {group.supplier.contact_name ?? "No contact"}
                        {group.supplier.phone ? ` · ${group.supplier.phone}` : ""}
                        {group.supplier.lead_time_days
                          ? ` · ${group.supplier.lead_time_days} day lead time`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted">{money(groupTotal, currency)} est.</span>
                      <CopyButton text={text} />
                      {mailto ? (
                        <a href={mailto} className="btn-primary btn-sm">
                          Email supplier
                        </a>
                      ) : (
                        <Link href={`/suppliers?edit=${group.supplier.id}`} className="btn-ghost btn-sm">
                          Add email
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px]">
                      <thead>
                        <tr className="border-b border-line">
                          <th className="th">Product</th>
                          <th className="th text-right">On hand</th>
                          <th className="th text-right">Reorder at</th>
                          <th className="th text-right">Suggested</th>
                          <th className="th text-right">Unit cost</th>
                          <th className="th text-right">Line total</th>
                          <th className="th">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(({ product, suggested }) => (
                          <tr key={product.id} className="border-b border-line/60 last:border-0">
                            <td className="td">
                              <Link
                                href={`/products/${product.id}`}
                                className="font-medium text-white hover:text-[#9db4ff]"
                              >
                                {product.name}
                              </Link>
                              <p className="font-mono text-[11px] text-muted">{product.sku}</p>
                            </td>
                            <td className="td text-right tabular-nums">{number(product.on_hand)}</td>
                            <td className="td text-right tabular-nums text-muted">
                              {number(product.reorder_level)}
                            </td>
                            <td className="td text-right font-semibold tabular-nums text-white">
                              {number(suggested)} <span className="text-[11px] font-normal text-muted">{product.unit}</span>
                            </td>
                            <td className="td text-right tabular-nums text-muted">
                              {money(product.unit_cost, currency)}
                            </td>
                            <td className="td text-right tabular-nums text-muted">
                              {money(suggested * product.unit_cost, currency)}
                            </td>
                            <td className="td">
                              <StatusBadge product={product} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-muted no-print">
            Suggested quantity = max(2 × reorder level, reorder level + 1) − on hand. Adjust the
            reorder level on each product to tune this.
          </p>
        </>
      )}
    </div>
  );
}
