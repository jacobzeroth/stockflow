import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCategories, listProducts } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";
import {
  ArchivedBadge,
  EmptyState,
  Flash,
  PageHeader,
  Stat,
  StatusBadge,
  money,
  number,
} from "@/components/ui";
import { stockStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; status?: string; archived?: string; error?: string; ok?: string };
}) {
  const user = await requireUser();
  const viewer = user.role === "viewer";
  const archived = searchParams.archived === "1";
  const [products, categories, workspace] = await Promise.all([
    listProducts({
      search: searchParams.q,
      category: searchParams.category,
      status: searchParams.status,
      includeArchived: archived,
    }),
    listCategories(archived),
    getWorkspace(),
  ]);
  const currency = workspace.currency;

  const units = products.reduce((sum, product) => sum + product.on_hand, 0);
  const value = products.reduce((sum, product) => sum + product.on_hand * product.unit_cost, 0);
  const attention = products.filter((product) => stockStatus(product) !== "ok").length;
  const query = new URLSearchParams(
    Object.entries({
      q: searchParams.q ?? "",
      category: searchParams.category ?? "",
      status: searchParams.status ?? "",
      archived: archived ? "1" : "",
    }).filter(([, value]) => value && value !== "all") as [string, string][]
  ).toString();
  const archivedHref = `/products?${new URLSearchParams({
    ...(searchParams.q ? { q: searchParams.q } : {}),
    ...(searchParams.category ? { category: searchParams.category } : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
    ...(!archived ? { archived: "1" } : {}),
  }).toString()}`;

  return (
    <div>
      <PageHeader title="Products" subtitle="Catalogue, stock on hand and reorder thresholds">
        {!viewer ? (
          <>
            <Link href="/products/import" className="btn-ghost">
              Import CSV
            </Link>
            <a href={`/api/export/products${query ? `?${query}` : ""}`} className="btn-ghost">
              Export
            </a>
            <Link href="/products/new" className="btn-primary">
              New product
            </Link>
          </>
        ) : (
          <a href={`/api/export/products${query ? `?${query}` : ""}`} className="btn-ghost">
            Export
          </a>
        )}
      </PageHeader>

      <Flash error={searchParams.error} ok={searchParams.ok} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Products listed" value={number(products.length)} hint={archived ? "Including archived" : `${number(units)} units on hand`} />
        <Stat label="Stock value" value={money(value, currency)} hint="At weighted average cost" tone="brand" />
        <Stat
          label="Below threshold"
          value={number(attention)}
          hint="Includes out of stock"
          tone={attention ? "warn" : "ok"}
        />
      </div>

      <form className="card mt-5 grid gap-3 p-4 sm:grid-cols-[1fr_180px_170px_auto]">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          className="input"
          placeholder="Search name, SKU or category"
        />
        <select name="category" defaultValue={searchParams.category ?? "all"} className="input">
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? "all"} className="input">
          <option value="all">Any status</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="ok">In stock</option>
        </select>
        <button className="btn-ghost" type="submit">
          Apply
        </button>
      </form>

      <div className="mt-2 flex justify-end">
        <Link href={archivedHref} className="text-xs font-semibold text-[#9db4ff] hover:underline">
          {archived ? "Hide archived products" : "Show archived products"}
        </Link>
      </div>

      <div className="card mt-5 overflow-hidden">
        {products.length === 0 ? (
          <EmptyState
            title="No products match"
            body="Adjust the filters, or add a product to start tracking stock."
            action={{ href: "/products/new", label: "Add a product" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Product</th>
                  <th className="th">Category</th>
                  <th className="th text-right">On hand</th>
                  <th className="th text-right">Reorder</th>
                  <th className="th text-right">Cost</th>
                  <th className="th text-right">Value</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={`row-hover border-b border-line/60 last:border-0 ${
                      product.archived_at ? "opacity-60" : ""
                    }`}
                  >
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium text-white hover:text-[#9db4ff]"
                        >
                          {product.name}
                        </Link>
                        {product.archived_at ? <ArchivedBadge /> : null}
                      </div>
                      <p className="font-mono text-[11px] text-muted">
                        {product.sku}
                        {product.supplier_name ? ` · ${product.supplier_name}` : ""}
                      </p>
                    </td>
                    <td className="td text-muted">{product.category}</td>
                    <td className="td text-right tabular-nums">
                      {number(product.on_hand)}{" "}
                      <span className="text-[11px] text-muted">{product.unit}</span>
                    </td>
                    <td className="td text-right tabular-nums text-muted">
                      {number(product.reorder_level)}
                    </td>
                    <td className="td text-right tabular-nums text-muted">
                      {money(product.unit_cost, currency)}
                    </td>
                    <td className="td text-right tabular-nums">
                      {money(product.on_hand * product.unit_cost, currency)}
                    </td>
                    <td className="td">
                      <StatusBadge product={product} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Stock on hand is derived from the movement ledger — it cannot drift. Archive a product
        instead of deleting it so history stays intact.
      </p>
    </div>
  );
}
