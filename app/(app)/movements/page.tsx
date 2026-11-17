import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMovements, listProducts } from "@/lib/data";
import { isIsoDate } from "@/lib/validation";
import { MovementForm } from "@/components/movement-form";
import {
  EmptyState,
  Flash,
  KindBadge,
  PageHeader,
  Qty,
  number,
  when,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: {
    product?: string;
    kind?: string;
    from?: string;
    to?: string;
    error?: string;
    ok?: string;
  };
}) {
  const user = await requireUser();
  let from = searchParams.from && isIsoDate(searchParams.from) ? searchParams.from : undefined;
  let to = searchParams.to && isIsoDate(searchParams.to) ? searchParams.to : undefined;
  let dateError: string | undefined;

  if (
    (searchParams.from && !isIsoDate(searchParams.from)) ||
    (searchParams.to && !isIsoDate(searchParams.to))
  ) {
    dateError = "Dates were not valid, so the filter ignored them.";
  }
  if (from && to && from > to) {
    [from, to] = [to, from];
    dateError = "The date range was reversed to keep the filter valid.";
  }

  const [products, movements] = await Promise.all([
    listProducts(),
    listMovements({
      productId: searchParams.product,
      kind: searchParams.kind,
      from,
      to,
      limit: 300,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Stock movements"
        subtitle="Append-only ledger of every receipt, issue and stock count"
      >
        <a
          href={`/api/export/movements?product=${searchParams.product ?? ""}&kind=${
            searchParams.kind ?? ""
          }&from=${from ?? ""}&to=${to ?? ""}`}
          className="btn-ghost"
        >
          Export CSV
        </a>
      </PageHeader>

      <Flash error={searchParams.error ?? dateError} ok={searchParams.ok} />

      {user.role !== "viewer" && products.length > 0 ? (
        <MovementForm
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            on_hand: product.on_hand,
            unit_cost: product.unit_cost,
          }))}
          defaultProductId={searchParams.product}
          requestId={crypto.randomUUID()}
        />
      ) : null}

      <form className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_140px_150px_150px_auto]">
        <select name="product" defaultValue={searchParams.product ?? ""} className="input">
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.sku} — {product.name}
            </option>
          ))}
        </select>
        <select name="kind" defaultValue={searchParams.kind ?? "all"} className="input">
          <option value="all">Any type</option>
          <option value="in">Received</option>
          <option value="out">Issued</option>
          <option value="adjust">Adjusted</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="input"
          aria-label="From date"
        />
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="input"
          aria-label="To date"
        />
        <button className="btn-ghost" type="submit">
          Filter
        </button>
      </form>

      <div className="card mt-5 overflow-hidden">
        {movements.length === 0 ? (
          <EmptyState
            title="No movements found"
            body="Records appear here as soon as stock is received, issued or counted."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">When</th>
                  <th className="th">Product</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Change</th>
                  <th className="th">Reason</th>
                  <th className="th">Reference</th>
                  <th className="th">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="row-hover border-b border-line/60 last:border-0">
                    <td className="td whitespace-nowrap text-muted">{when(movement.created_at)}</td>
                    <td className="td">
                      <Link
                        href={`/products/${movement.product_id}`}
                        className="text-white hover:text-[#9db4ff]"
                      >
                        {movement.product_name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted">{movement.product_sku}</p>
                    </td>
                    <td className="td">
                      <KindBadge kind={movement.kind} />
                    </td>
                    <td className="td text-right">
                      <Qty value={movement.quantity} />
                      <span className="ml-1 text-[11px] text-muted">{movement.unit}</span>
                    </td>
                    <td className="td text-muted">{movement.reason ?? "—"}</td>
                    <td className="td font-mono text-[11px] text-muted">{movement.reference ?? "—"}</td>
                    <td className="td text-muted">{movement.created_by_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Showing {number(movements.length)} entries (max 300). Export the CSV for the full history.
      </p>
    </div>
  );
}
