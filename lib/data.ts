import { one, query, toNumber } from "./db";
import type {
  AuditEntry,
  Movement,
  MovementKind,
  Product,
  Supplier,
  User,
} from "./types";

type ProductRow = Omit<Product, "unit_cost" | "unit_price" | "on_hand"> & {
  unit_cost: number | string;
  unit_price: number | string;
  on_hand: number | string;
};

const PRODUCT_SELECT = `
  select p.id, p.sku, p.name, p.category, p.unit,
         p.unit_cost::float8 as unit_cost,
         p.unit_price::float8 as unit_price,
         p.reorder_level, p.supplier_id, p.notes, p.archived_at, p.created_at,
         s.name as supplier_name,
         coalesce(sum(m.quantity), 0)::int as on_hand
    from products p
    left join suppliers s on s.id = p.supplier_id
    left join movements m on m.product_id = p.id
`;

function mapProduct(row: ProductRow): Product {
  return {
    ...row,
    unit_cost: toNumber(row.unit_cost),
    unit_price: toNumber(row.unit_price),
    on_hand: toNumber(row.on_hand),
  };
}

export type ProductFilter = {
  search?: string;
  category?: string;
  status?: string;
  includeArchived?: boolean;
};

export async function listProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!filter.includeArchived) where.push("p.archived_at is null");
  if (filter.search) {
    params.push(`%${filter.search.toLowerCase()}%`);
    where.push(
      `(lower(p.name) like $${params.length} or lower(p.sku) like $${params.length} or lower(p.category) like $${params.length})`
    );
  }
  if (filter.category && filter.category !== "all") {
    params.push(filter.category);
    where.push(`p.category = $${params.length}`);
  }

  const sql = `${PRODUCT_SELECT}
    ${where.length ? `where ${where.join(" and ")}` : ""}
    group by p.id, s.name
    order by p.archived_at nulls first, lower(p.name)`;

  const rows = await query<ProductRow>(sql, params);
  let products = rows.map(mapProduct);

  if (filter.status && filter.status !== "all") {
    products = products.filter((product) => {
      if (filter.status === "out") return product.on_hand <= 0;
      if (filter.status === "low")
        return product.on_hand > 0 && product.on_hand <= product.reorder_level;
      if (filter.status === "ok") return product.on_hand > product.reorder_level;
      return true;
    });
  }

  return products;
}

export async function getProduct(id: string): Promise<Product | null> {
  const row = await one<ProductRow>(
    `${PRODUCT_SELECT} where p.id = $1 group by p.id, s.name`,
    [id]
  );
  return row ? mapProduct(row) : null;
}

export async function listCategories(): Promise<string[]> {
  const rows = await query<{ category: string }>(
    "select distinct category from products where archived_at is null order by category"
  );
  return rows.map((row) => row.category);
}

export async function listSuppliers(includeArchived = false): Promise<Supplier[]> {
  const rows = await query<Supplier & { product_count: number | string }>(
    `select s.*, count(p.id)::int as product_count
       from suppliers s
       left join products p on p.supplier_id = s.id and p.archived_at is null
      ${includeArchived ? "" : "where s.archived_at is null"}
      group by s.id
      order by s.archived_at nulls first, lower(s.name)`
  );
  return rows.map((row) => ({
    ...row,
    product_count: toNumber(row.product_count),
  }));
}

export type MovementFilter = {
  productId?: string;
  kind?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function listMovements(filter: MovementFilter = {}): Promise<Movement[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.productId) {
    params.push(filter.productId);
    where.push(`m.product_id = $${params.length}`);
  }
  if (filter.kind && filter.kind !== "all") {
    params.push(filter.kind);
    where.push(`m.kind = $${params.length}`);
  }
  if (filter.from) {
    params.push(filter.from);
    where.push(`m.created_at >= $${params.length}::date`);
  }
  if (filter.to) {
    params.push(filter.to);
    where.push(`m.created_at < ($${params.length}::date + interval '1 day')`);
  }

  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  params.push(limit);

  return query<Movement>(
    `select m.id, m.product_id, p.name as product_name, p.sku as product_sku,
            p.unit, m.kind, m.quantity,
            m.unit_cost::float8 as unit_cost, m.reason, m.reference, m.note,
            m.created_by, u.name as created_by_name, m.created_at
       from movements m
       join products p on p.id = m.product_id
       left join users u on u.id = m.created_by
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by m.created_at desc
      limit $${params.length}`,
    params
  );
}

export async function listUsers(): Promise<User[]> {
  return query<User>(
    "select id, email, name, role, active, created_at from users order by created_at"
  );
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  return query<AuditEntry>(
    `select id, user_name, action, entity, entity_id, detail, created_at
       from audit_log order by created_at desc limit $1`,
    [Math.min(Math.max(limit, 1), 500)]
  );
}

export type DashboardData = {
  products: Product[];
  recent: Movement[];
  unitsOnHand: number;
  stockValue: number;
  retailValue: number;
  lowStock: Product[];
  outOfStock: number;
  categories: { name: string; units: number; value: number }[];
  movementsThisMonth: number;
};

export async function getDashboard(): Promise<DashboardData> {
  const [products, recent, movementStats] = await Promise.all([
    listProducts(),
    listMovements({ limit: 8 }),
    one<{ count: string }>(
      "select count(*)::text as count from movements where created_at >= date_trunc('month', now())"
    ),
  ]);

  const unitsOnHand = products.reduce((sum, p) => sum + p.on_hand, 0);
  const stockValue = products.reduce((sum, p) => sum + p.on_hand * p.unit_cost, 0);
  const retailValue = products.reduce((sum, p) => sum + p.on_hand * p.unit_price, 0);

  const categoryMap = new Map<string, { units: number; value: number }>();
  for (const product of products) {
    const entry = categoryMap.get(product.category) ?? { units: 0, value: 0 };
    entry.units += product.on_hand;
    entry.value += product.on_hand * product.unit_cost;
    categoryMap.set(product.category, entry);
  }

  return {
    products,
    recent,
    unitsOnHand,
    stockValue,
    retailValue,
    lowStock: products
      .filter((p) => p.on_hand <= p.reorder_level)
      .sort((a, b) => a.on_hand - b.on_hand),
    outOfStock: products.filter((p) => p.on_hand <= 0).length,
    categories: [...categoryMap.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.value - a.value),
    movementsThisMonth: Number(movementStats?.count ?? 0),
  };
}

export type ReorderGroup = {
  supplier: Supplier;
  items: { product: Product; suggested: number }[];
};

export async function getReorderGroups(): Promise<ReorderGroup[]> {
  const [products, suppliers] = await Promise.all([listProducts(), listSuppliers()]);
  const low = products.filter((p) => p.on_hand <= p.reorder_level);
  const groups = new Map<string, ReorderGroup>();

  for (const product of low) {
    const key = product.supplier_id ?? "unassigned";
    let group = groups.get(key);
    if (!group) {
      const supplier =
        suppliers.find((s) => s.id === product.supplier_id) ?? {
          id: "unassigned",
          name: "Unassigned supplier",
          contact_name: null,
          email: null,
          phone: null,
          lead_time_days: 0,
          notes: null,
          archived_at: null,
          created_at: "",
        };
      group = { supplier, items: [] };
      groups.set(key, group);
    }
    const target = Math.max(product.reorder_level * 2, product.reorder_level + 1);
    group.items.push({ product, suggested: Math.max(target - product.on_hand, 1) });
  }

  return [...groups.values()].sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
}

export type ReportData = {
  from: string;
  to: string;
  totalIn: number;
  totalOut: number;
  movementCount: number;
  valuation: { category: string; units: number; cost: number; retail: number }[];
  topOut: { name: string; sku: string; units: number }[];
  activeSkus: number;
};

export async function getReport(from: string, to: string): Promise<ReportData> {
  const [products, movementTotals, topOut] = await Promise.all([
    listProducts(),
    one<{ total_in: string; total_out: string; count: string }>(
      `select
         coalesce(sum(case when quantity > 0 then quantity else 0 end), 0)::text as total_in,
         coalesce(sum(case when quantity < 0 then -quantity else 0 end), 0)::text as total_out,
         count(*)::text as count
       from movements
       where created_at >= $1::date and created_at < ($2::date + interval '1 day')`,
      [from, to]
    ),
    query<{ name: string; sku: string; units: number | string }>(
      `select p.name, p.sku, sum(-m.quantity)::int as units
         from movements m join products p on p.id = m.product_id
        where m.quantity < 0
          and m.created_at >= $1::date and m.created_at < ($2::date + interval '1 day')
        group by p.id, p.name, p.sku
        order by units desc
        limit 8`,
      [from, to]
    ),
  ]);

  const valuationMap = new Map<string, { units: number; cost: number; retail: number }>();
  for (const product of products) {
    const entry = valuationMap.get(product.category) ?? { units: 0, cost: 0, retail: 0 };
    entry.units += product.on_hand;
    entry.cost += product.on_hand * product.unit_cost;
    entry.retail += product.on_hand * product.unit_price;
    valuationMap.set(product.category, entry);
  }

  return {
    from,
    to,
    totalIn: toNumber(movementTotals?.total_in),
    totalOut: toNumber(movementTotals?.total_out),
    movementCount: toNumber(movementTotals?.count),
    valuation: [...valuationMap.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.cost - a.cost),
    topOut: topOut.map((row) => ({ ...row, units: toNumber(row.units) })),
    activeSkus: products.filter((p) => p.on_hand > 0).length,
  };
}

export function isMovementKind(value: string): value is MovementKind {
  return value === "in" || value === "out" || value === "adjust";
}
