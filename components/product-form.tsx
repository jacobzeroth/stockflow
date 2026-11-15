import type { Product, Supplier } from "@/lib/types";

export function ProductForm({
  action,
  product,
  suppliers,
  submitLabel,
  returnTo,
  showOpening = false,
}: {
  action: (formData: FormData) => Promise<void>;
  product?: Product;
  suppliers: Supplier[];
  submitLabel: string;
  returnTo: string;
  showOpening?: boolean;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="return_to" value={returnTo} />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sku">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            required
            defaultValue={product?.sku}
            className="input font-mono uppercase"
            placeholder="RM-CRE-300"
          />
          <p className="mt-1 text-[11px] text-muted">Unique, case-insensitive. Used for imports.</p>
        </div>
        <div>
          <label className="label" htmlFor="name">
            Product name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={product?.name}
            className="input"
            placeholder="Creatine Monohydrate 300 g"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <input
            id="category"
            name="category"
            defaultValue={product?.category ?? "General"}
            className="input"
            list="category-options"
            placeholder="Raw material"
          />
          <datalist id="category-options">
            <option value="Raw material" />
            <option value="Packaging" />
            <option value="Finished goods" />
            <option value="Consumables" />
            <option value="General" />
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="unit">
            Unit
          </label>
          <input
            id="unit"
            name="unit"
            defaultValue={product?.unit ?? "unit"}
            className="input"
            placeholder="jar, piece, kg"
          />
        </div>
        <div>
          <label className="label" htmlFor="supplier_id">
            Supplier
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            defaultValue={product?.supplier_id ?? ""}
            className="input"
          >
            <option value="">Unassigned</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="unit_cost">
            Unit cost
          </label>
          <input
            id="unit_cost"
            name="unit_cost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product ? product.unit_cost.toFixed(2) : "0.00"}
            className="input tabular-nums"
          />
        </div>
        <div>
          <label className="label" htmlFor="unit_price">
            Selling price
          </label>
          <input
            id="unit_price"
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product ? product.unit_price.toFixed(2) : "0.00"}
            className="input tabular-nums"
          />
        </div>
        <div>
          <label className="label" htmlFor="reorder_level">
            Reorder level
          </label>
          <input
            id="reorder_level"
            name="reorder_level"
            type="number"
            step="1"
            min="0"
            defaultValue={product?.reorder_level ?? 0}
            className="input tabular-nums"
          />
          <p className="mt-1 text-[11px] text-muted">Flag stock at or below this quantity.</p>
        </div>
      </div>

      {showOpening ? (
        <div className="sm:w-1/3">
          <label className="label" htmlFor="opening_stock">
            Opening stock
          </label>
          <input
            id="opening_stock"
            name="opening_stock"
            type="number"
            step="1"
            min="0"
            defaultValue={0}
            className="input tabular-nums"
          />
          <p className="mt-1 text-[11px] text-muted">
            Recorded as an &ldquo;Opening balance&rdquo; receipt in the ledger.
          </p>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={product?.notes ?? ""}
          className="input resize-y"
          placeholder="Supplier spec, storage requirements, anything worth remembering."
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
