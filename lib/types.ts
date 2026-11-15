export type Role = "owner" | "manager" | "viewer";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  product_count?: number;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number;
  unit_price: number;
  reorder_level: number;
  supplier_id: string | null;
  supplier_name: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  on_hand: number;
};

export type StockStatus = "out" | "low" | "ok";

export type MovementKind = "in" | "out" | "adjust";

export type Movement = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  unit: string;
  kind: MovementKind;
  quantity: number;
  unit_cost: number | null;
  reason: string | null;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
};

export function stockStatus(product: Pick<Product, "on_hand" | "reorder_level">): StockStatus {
  if (product.on_hand <= 0) return "out";
  if (product.on_hand <= product.reorder_level) return "low";
  return "ok";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Low stock",
  ok: "In stock",
};
