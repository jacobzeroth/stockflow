import Link from "next/link";
import { createProductAction } from "@/app/actions/inventory";
import { requireWriter } from "@/lib/auth";
import { listSuppliers } from "@/lib/data";
import { ProductForm } from "@/components/product-form";
import { Flash, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireWriter();
  const suppliers = await listSuppliers();

  return (
    <div className="max-w-3xl">
      <PageHeader title="New product" subtitle="Add an item to the catalogue and optionally set opening stock">
        <Link href="/products" className="btn-ghost">
          Cancel
        </Link>
      </PageHeader>

      <Flash error={searchParams.error} />

      <div className="card p-5">
        <ProductForm
          action={createProductAction}
          suppliers={suppliers}
          submitLabel="Create product"
          returnTo="/products/new"
          showOpening
        />
      </div>

      <p className="mt-3 text-xs text-muted">
        Need to add many items at once?{" "}
        <Link href="/products/import" className="link">
          Import a CSV
        </Link>
        .
      </p>
    </div>
  );
}
