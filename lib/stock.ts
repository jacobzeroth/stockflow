import type { PoolClient } from "pg";

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

export type MovementKind = "in" | "out" | "adjust";

export type MovementRequest = {
  productId: string;
  kind: MovementKind;
  quantity?: number;
  counted?: number;
  unitCost?: number | null;
  reason: string;
  reference?: string | null;
  note?: string | null;
  requestId?: string | null;
  user: { id: string; name: string };
};

export type MovementResult = {
  productName: string;
  delta: number;
  balance: number;
  unitCost: number | null;
  duplicate: boolean;
};

export function weightedAverageCost(
  onHand: number,
  currentCost: number,
  incomingQuantity: number,
  incomingCost: number
): number {
  if (incomingQuantity <= 0) return currentCost;
  const total = onHand + incomingQuantity;
  if (total <= 0) return incomingCost;
  return Math.round(((onHand * currentCost + incomingQuantity * incomingCost) / total) * 100) / 100;
}

const MAX_QUANTITY = 1_000_000;

function requireWhole(value: number | undefined, label: string, min: number): number {
  if (value === undefined || !Number.isInteger(value)) {
    throw new StockError(`${label} must be a whole number.`);
  }
  if (value < min) {
    throw new StockError(
      min === 0 ? `${label} cannot be negative.` : `${label} must be greater than zero.`
    );
  }
  if (value > MAX_QUANTITY) throw new StockError(`${label} is too large.`);
  return value;
}

export async function recordMovement(
  client: PoolClient,
  input: MovementRequest
): Promise<MovementResult> {
  if (input.kind !== "in" && input.kind !== "out" && input.kind !== "adjust") {
    throw new StockError("Choose a valid movement type.");
  }

  const productResult = await client.query<{
    id: string;
    name: string;
    unit_cost: string;
    archived_at: string | null;
  }>(
    `select id, name, unit_cost::float8 as unit_cost, archived_at
       from products
      where id = $1
      for update`,
    [input.productId]
  );
  const product = productResult.rows[0];
  if (!product) throw new StockError("Product not found.");
  if (product.archived_at) {
    throw new StockError("This product is archived. Restore it before recording movements.");
  }

  const stockResult = await client.query<{ on_hand: number }>(
    "select coalesce(sum(quantity), 0)::int as on_hand from movements where product_id = $1",
    [input.productId]
  );
  const onHand = Number(stockResult.rows[0]?.on_hand ?? 0);
  const currentCost = Number(product.unit_cost);

  let delta = 0;
  let unitCost: number | null = null;

  if (input.kind === "adjust") {
    const counted = requireWhole(input.counted, "Counted quantity", 0);
    delta = counted - onHand;
    if (delta === 0) {
      throw new StockError(
        `Counted quantity matches stock on hand (${onHand}). Nothing to adjust.`
      );
    }
  } else {
    const quantity = requireWhole(input.quantity, "Quantity", 1);
    delta = input.kind === "in" ? quantity : -quantity;
    if (input.unitCost !== null && input.unitCost !== undefined) {
      if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
        throw new StockError("Unit cost cannot be negative.");
      }
      unitCost = Math.round(input.unitCost * 100) / 100;
    } else {
      unitCost = currentCost;
    }
  }

  const next = onHand + delta;
  if (next < 0) {
    throw new StockError(
      `Not enough stock: ${product.name} has ${onHand}, cannot remove ${Math.abs(delta)}.`
    );
  }

  const requestId = input.requestId?.trim() || null;
  const insert = await client.query(
    `insert into movements
       (id, product_id, kind, quantity, unit_cost, reason, reference, note, created_by, request_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (request_id) do nothing`,
    [
      crypto.randomUUID(),
      input.productId,
      input.kind,
      delta,
      unitCost,
      input.reason,
      input.reference ?? null,
      input.note ?? null,
      input.user.id,
      requestId,
    ]
  );

  if (insert.rowCount === 0) {
    return {
      productName: product.name,
      delta,
      balance: onHand,
      unitCost,
      duplicate: true,
    };
  }

  if (input.kind === "in" && unitCost !== null && delta > 0) {
    const average = weightedAverageCost(onHand, currentCost, delta, unitCost);
    await client.query("update products set unit_cost = $1 where id = $2", [
      average,
      input.productId,
    ]);
  }

  await client.query(
    `insert into audit_log (id, user_id, user_name, action, entity, entity_id, detail)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      crypto.randomUUID(),
      input.user.id,
      input.user.name,
      `stock.${input.kind}`,
      "product",
      input.productId,
      JSON.stringify({
        delta,
        reason: input.reason,
        reference: input.reference ?? null,
        balance: next,
      }).slice(0, 2000),
    ]
  );

  return {
    productName: product.name,
    delta,
    balance: next,
    unitCost,
    duplicate: false,
  };
}
