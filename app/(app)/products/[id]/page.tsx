import Link from "next/link";
import { notFound } from "next/navigation";
import { recordMovementAction, updateProductAction, archiveProductAction } from "@/app/actions/inventory";
import { requireUser } from "@/lib/auth";
import { getProduct, listMovements, listSuppliers } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";
import { ProductForm } from "@/components/product-form";
import {
  ArchivedBadge,
  CardHeader,
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

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; ok?: string };
}) {
  const user = await requireUser();
  const product = await getProduct(params.id);
  if (!product) notFound();

  const [suppliers, movements, workspace] = await Promise.all([
    listSuppliers(),
    listMovements({ productId: product.id, limit: 60 }),
    getWorkspace(),
  ]);
  const currency = workspace.currency;
  const readOnly = user.role === "viewer";
  const returnTo = `/products/${product.id}`;

  return (
    <div>
      <div className="mb-4 text-xs text-muted">
        <Link href={product.archived_at ? "/products?archived=1" : "/products"} className="hover:text-silver">
          Products
        </Link>{" "}
        / <span className="text-silver">{product.name}</span>
      </div>

      <PageHeader title={product.name} subtitle={`${product.sku} · ${product.category} · per ${product.unit}`}>
        <StatusBadge product={product} />
        {product.archived_at ? <ArchivedBadge /> : null}
        <a href={`/api/export/movements?product=${product.id}`} className="btn-ghost">
          Export history
        </a>
        {!readOnly ? (
          <form action={archiveProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <input type="hidden" name="restore" value={product.archived_at ? "1" : "0"} />
            <button className={product.archived_at ? "btn-ghost" : "btn-danger"} type="submit">
              {product.archived_at ? "Restore product" : "Archive product"}
            </button>
          </form>
        ) : null}
      </PageHeader>

      <Flash error={searchParams.error} ok={searchParams.ok} />

      {product.archived_at ? (
        <div className="mb-5 rounded-lg border border-[#5a481f] bg-[#201c0d] px-4 py-3 text-sm text-[#f6ce74]">
          This product is archived. It is hidden from the catalogue, reorder list and stock
          movements, but its movement history is preserved. Restore it to record new stock.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="On hand" value={`${number(product.on_hand)} ${product.unit}`} tone={product.on_hand <= 0 ? "bad" : "default"} />
        <Stat label="Reorder level" value={number(product.reorder_level)} hint="Flag at or below" />
        <Stat label="Unit cost" value={money(product.unit_cost, currency)} hint="Weighted average" />
        <Stat
          label="Stock value"
          value={money(product.on_hand * product.unit_cost, currency)}
          hint={product.unit_price > 0 ? `${money(product.on_hand * product.unit_price, currency)} at selling price` : undefined}
          tone="brand"
        />
      </div>

      {!readOnly && !product.archived_at ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <form action={recordMovementAction} className="card p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="kind" value="in" />
            <input type="hidden" name="return_to" value={returnTo} />
            <input type="hidden" name="request_id" value={crypto.randomUUID()} />
            <h2 className="text-sm font-semibold text-white">Receive stock</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">Purchase receipts and returns to stock.</p>
            <label className="label" htmlFor="in-qty">
              Quantity
            </label>
            <input id="in-qty" name="quantity" type="number" min="1" step="1" required className="input tabular-nums" />
            <label className="label mt-3" htmlFor="in-cost">
              Unit cost (optional)
            </label>
            <input
              id="in-cost"
              name="unit_cost"
              type="number"
              min="0"
              step="0.01"
              className="input tabular-nums"
              placeholder={product.unit_cost.toFixed(2)}
            />
            <label className="label mt-3" htmlFor="in-ref">
              Reference
            </label>
            <input id="in-ref" name="reference" className="input" placeholder="PO-1042" />
            <button className="btn-primary mt-4 w-full" type="submit">
              Record receipt
            </button>
          </form>

          <form action={recordMovementAction} className="card p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="kind" value="out" />
            <input type="hidden" name="return_to" value={returnTo} />
            <input type="hidden" name="request_id" value={crypto.randomUUID()} />
            <h2 className="text-sm font-semibold text-white">Issue stock</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              Sales, production use or write-offs. Cannot go below zero.
            </p>
            <label className="label" htmlFor="out-qty">
              Quantity
            </label>
            <input id="out-qty" name="quantity" type="number" min="1" step="1" required className="input tabular-nums" />
            <label className="label mt-3" htmlFor="out-reason">
              Reason
            </label>
            <input id="out-reason" name="reason" className="input" placeholder="Customer order" />
            <label className="label mt-3" htmlFor="out-ref">
              Reference
            </label>
            <input id="out-ref" name="reference" className="input" placeholder="Order #118" />
            <button className="btn-ghost mt-4 w-full" type="submit">
              Record issue
            </button>
          </form>

          <form action={recordMovementAction} className="card p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="kind" value="adjust" />
            <input type="hidden" name="return_to" value={returnTo} />
            <input type="hidden" name="request_id" value={crypto.randomUUID()} />
            <h2 className="text-sm font-semibold text-white">Adjust to count</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              Enter the physical count. The ledger records the difference.
            </p>
            <label className="label" htmlFor="counted">
              Counted quantity
            </label>
            <input
              id="counted"
              name="counted"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={product.on_hand}
              className="input tabular-nums"
            />
            <label className="label mt-3" htmlFor="adj-note">
              Note
            </label>
            <input id="adj-note" name="note" className="input" placeholder="Month-end stock count" />
            <p className="mt-3 text-xs text-muted">
              Current system quantity: <span className="tabular-nums text-silver">{number(product.on_hand)}</span>
            </p>
            <button className="btn-ghost mt-4 w-full" type="submit">
              Post adjustment
            </button>
          </form>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <CardHeader title="Movement history" hint={`${movements.length} entries`} />
          {movements.length === 0 ? (
            <p className="p-5 text-sm text-muted">No movements yet for this product.</p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[520px]">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-line">
                    <th className="th">When</th>
                    <th className="th">Type</th>
                    <th className="th text-right">Change</th>
                    <th className="th">Detail</th>
                    <th className="th">By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-line/60 last:border-0">
                      <td className="td whitespace-nowrap text-muted">{when(movement.created_at)}</td>
                      <td className="td">
                        <KindBadge kind={movement.kind} />
                      </td>
                      <td className="td text-right">
                        <Qty value={movement.quantity} />
                      </td>
                      <td className="td text-muted">
                        {movement.reason ?? "—"}
                        {movement.reference ? (
                          <span className="ml-1 font-mono text-[11px] text-muted/80">{movement.reference}</span>
                        ) : null}
                        {movement.note ? <p className="text-[11px]">{movement.note}</p> : null}
                      </td>
                      <td className="td text-muted">{movement.created_by_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Product details</h2>
          {readOnly ? (
            <dl className="space-y-2 text-sm">
              <Row label="SKU" value={product.sku} />
              <Row label="Category" value={product.category} />
              <Row label="Unit" value={product.unit} />
              <Row label="Supplier" value={product.supplier_name ?? "Unassigned"} />
              <Row label="Selling price" value={money(product.unit_price, currency)} />
              <Row label="Notes" value={product.notes ?? "—"} />
            </dl>
          ) : (
            <ProductForm
              action={updateProductAction}
              product={product}
              suppliers={suppliers}
              submitLabel="Save changes"
              returnTo={returnTo}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-silver">{value}</dd>
    </div>
  );
}
