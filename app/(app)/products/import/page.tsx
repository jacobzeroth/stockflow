import Link from "next/link";
import { importProductsAction } from "@/app/actions/inventory";
import { requireWriter } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireWriter();
  const sp = await searchParams;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Import products" subtitle="Create or update products from a CSV file">
        <a href="/api/export/template" className="btn-ghost">
          Download template
        </a>
        <Link href="/products" className="btn-ghost">
          Back to products
        </Link>
      </PageHeader>

      <Flash error={sp.error} ok={sp.ok} />

      <div className="card p-5">
        <form action={importProductsAction} className="space-y-4">
          <div>
            <label className="label" htmlFor="file">
              CSV file
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="block w-full cursor-pointer rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#2a5cff]"
            />
            <p className="mt-1 text-[11px] text-muted">Maximum 2 MB. First row must be the header.</p>
          </div>
          <button className="btn-primary" type="submit">
            Import products
          </button>
        </form>
      </div>

      <div className="card mt-5 p-5">
        <h2 className="text-sm font-semibold text-white">How the import behaves</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            <span className="text-silver">Matching:</span> rows are matched on SKU
            (case-insensitive). Existing products are updated, new SKUs are created.
          </li>
          <li>
            <span className="text-silver">Required columns:</span>{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs text-silver">sku</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs text-silver">name</code>.
          </li>
          <li>
            <span className="text-silver">Optional:</span>{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">category</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">unit</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">unit_cost</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">unit_price</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">reorder_level</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">supplier</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">opening_stock</code>,{" "}
            <code className="rounded bg-panel2 px-1 py-0.5 font-mono text-xs">notes</code>.
          </li>
          <li>
            <span className="text-silver">Opening stock</span> is only applied when a product is
            created, so re-importing the same file never double counts stock.
          </li>
          <li>
            <span className="text-silver">Suppliers</span> are matched by exact name. Unknown names
            leave the product unassigned and are reported back to you.
          </li>
        </ul>
      </div>
    </div>
  );
}
