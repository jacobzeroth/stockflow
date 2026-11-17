"use client";

import { useState } from "react";
import { recordMovementAction } from "@/app/actions/inventory";

type Option = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  on_hand: number;
  unit_cost?: number;
};

const KINDS = [
  { value: "in", label: "Receive" },
  { value: "out", label: "Issue" },
  { value: "adjust", label: "Count" },
];

export function MovementForm({
  products,
  defaultProductId,
  returnTo = "/movements",
  requestId,
}: {
  products: Option[];
  defaultProductId?: string;
  returnTo?: string;
  requestId?: string;
}) {
  const [kind, setKind] = useState("in");
  const [productId, setProductId] = useState(defaultProductId ?? products[0]?.id ?? "");
  const selected = products.find((product) => product.id === productId);

  return (
    <form action={recordMovementAction} className="card p-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="return_to" value={returnTo} />
      {requestId ? <input type="hidden" name="request_id" value={requestId} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Record a movement</h2>
          <p className="text-xs text-muted">Every entry is written to the permanent ledger.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-panel2 p-1">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                kind === option.value
                  ? "bg-brand text-white"
                  : "text-muted hover:text-silver"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="product_id">
            Product
          </label>
          <select
            id="product_id"
            name="product_id"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="input"
            required
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name} ({product.on_hand} {product.unit})
              </option>
            ))}
          </select>
        </div>

        {kind === "adjust" ? (
          <div>
            <label className="label" htmlFor="counted">
              Counted qty
            </label>
            <input
              key={`${kind}-${selected?.id ?? "no-product"}`}
              id="counted"
              name="counted"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={selected?.on_hand ?? 0}
              className="input tabular-nums"
            />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="quantity">
              Quantity
            </label>
            <input
              key={kind}
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              step="1"
              required
              className="input tabular-nums"
            />
          </div>
        )}

        {kind === "in" ? (
          <div>
            <label className="label" htmlFor="unit_cost">
              Unit cost
            </label>
            <input
              id="unit_cost"
              name="unit_cost"
              type="number"
              min="0"
              step="0.01"
              className="input tabular-nums"
              placeholder={
                selected?.unit_cost !== undefined
                  ? `Current ${selected.unit_cost.toFixed(2)}`
                  : "Optional"
              }
            />
            <p className="mt-1 text-[11px] text-muted">Blank keeps the weighted average cost.</p>
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="reason">
            Reason
          </label>
          <input
            key={kind}
            id="reason"
            name="reason"
            className="input"
            placeholder={kind === "in" ? "Purchase receipt" : kind === "out" ? "Customer order" : "Stock count"}
          />
        </div>

        <div>
          <label className="label" htmlFor="reference">
            Reference
          </label>
          <input key={kind} id="reference" name="reference" className="input" placeholder="PO-1042" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {selected
            ? `${selected.name}: ${selected.on_hand} ${selected.unit} on hand${
                kind === "adjust" ? " — enter the physical count" : ""
              }`
            : "Choose a product to continue"}
        </p>
        <button className="btn-primary" type="submit" disabled={!products.length}>
          Post {kind === "in" ? "receipt" : kind === "out" ? "issue" : "adjustment"}
        </button>
      </div>
    </form>
  );
}
