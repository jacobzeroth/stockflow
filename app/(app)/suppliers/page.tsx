import { archiveSupplierAction, saveSupplierAction } from "@/app/actions/inventory";
import { requireUser } from "@/lib/auth";
import { listSuppliers } from "@/lib/data";
import { EmptyState, Flash, PageHeader, number } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: { edit?: string; error?: string; ok?: string };
}) {
  const user = await requireUser();
  const suppliers = await listSuppliers(true);
  const editing = searchParams.edit
    ? suppliers.find((supplier) => supplier.id === searchParams.edit)
    : undefined;
  const readOnly = user.role === "viewer";

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Who you buy from, lead times and the products they supply"
      />

      <Flash error={searchParams.error} ok={searchParams.ok} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="card overflow-hidden">
          {suppliers.length === 0 ? (
            <EmptyState
              title="No suppliers yet"
              body="Add a supplier so products can be grouped into purchase orders and reorder lists."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Supplier</th>
                    <th className="th">Contact</th>
                    <th className="th text-right">Lead time</th>
                    <th className="th text-right">Products</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className={`row-hover border-b border-line/60 last:border-0 ${
                        supplier.archived_at ? "opacity-60" : ""
                      }`}
                    >
                      <td className="td">
                        <p className="font-medium text-white">{supplier.name}</p>
                        {supplier.archived_at ? (
                          <p className="text-[11px] text-warn">Archived</p>
                        ) : supplier.notes ? (
                          <p className="max-w-[220px] truncate text-[11px] text-muted">{supplier.notes}</p>
                        ) : null}
                      </td>
                      <td className="td text-muted">
                        {supplier.contact_name ?? "—"}
                        {supplier.phone ? (
                          <p className="text-[11px] text-muted/80">{supplier.phone}</p>
                        ) : null}
                      </td>
                      <td className="td text-right tabular-nums text-muted">
                        {number(supplier.lead_time_days)} d
                      </td>
                      <td className="td text-right tabular-nums text-muted">
                        {number(supplier.product_count ?? 0)}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1.5">
                          {!readOnly ? (
                            <a
                              href={`/suppliers?edit=${supplier.id}`}
                              className="btn-ghost btn-sm"
                            >
                              Edit
                            </a>
                          ) : null}
                          {!readOnly ? (
                            <form action={archiveSupplierAction}>
                              <input type="hidden" name="id" value={supplier.id} />
                              <input
                                type="hidden"
                                name="restore"
                                value={supplier.archived_at ? "1" : "0"}
                              />
                              <button className="btn-ghost btn-sm" type="submit">
                                {supplier.archived_at ? "Restore" : "Archive"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!readOnly ? (
          <div className="card h-fit p-5">
            <h2 className="text-sm font-semibold text-white">
              {editing ? `Edit ${editing.name}` : "Add supplier"}
            </h2>
            <form action={saveSupplierAction} className="mt-4 space-y-3" key={editing?.id ?? "new"}>
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <div>
                <label className="label" htmlFor="name">
                  Company name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={editing?.name}
                  className="input"
                  placeholder="Nordic Raw Materials"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="contact_name">
                    Contact person
                  </label>
                  <input
                    id="contact_name"
                    name="contact_name"
                    defaultValue={editing?.contact_name ?? ""}
                    className="input"
                    placeholder="Ingrid Holm"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    defaultValue={editing?.phone ?? ""}
                    className="input"
                    placeholder="+46 8 555 0110"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editing?.email ?? ""}
                    className="input"
                    placeholder="orders@supplier.com"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lead_time_days">
                    Lead time (days)
                  </label>
                  <input
                    id="lead_time_days"
                    name="lead_time_days"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={editing?.lead_time_days ?? 7}
                    className="input tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  defaultValue={editing?.notes ?? ""}
                  className="input resize-y"
                  placeholder="Minimum order value, payment terms…"
                />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" type="submit">
                  {editing ? "Save supplier" : "Add supplier"}
                </button>
                {editing ? (
                  <a href="/suppliers" className="btn-ghost">
                    Cancel
                  </a>
                ) : null}
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
