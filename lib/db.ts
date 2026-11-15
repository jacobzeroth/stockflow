import { Pool, type PoolClient } from "pg";

const globalForDb = globalThis as unknown as {
  sfPool?: Pool;
  sfSchema?: Promise<void>;
};

const SCHEMA = [
  `create table if not exists users (
    id text primary key,
    email text not null unique,
    name text not null,
    password_hash text not null,
    role text not null default 'owner' check (role in ('owner','manager','viewer')),
    active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sessions (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists sessions_user_idx on sessions (user_id)`,
  `create table if not exists suppliers (
    id text primary key,
    name text not null,
    contact_name text,
    email text,
    phone text,
    lead_time_days integer not null default 7,
    notes text,
    archived_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists products (
    id text primary key,
    sku text not null,
    name text not null,
    category text not null default 'General',
    unit text not null default 'unit',
    unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
    unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
    reorder_level integer not null default 0 check (reorder_level >= 0),
    supplier_id text references suppliers(id) on delete set null,
    notes text,
    archived_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists products_sku_key on products (lower(sku))`,
  `create table if not exists movements (
    id text primary key,
    product_id text not null references products(id) on delete cascade,
    kind text not null check (kind in ('in','out','adjust')),
    quantity integer not null check (quantity <> 0),
    unit_cost numeric(12,2),
    reason text,
    reference text,
    note text,
    created_by text references users(id) on delete set null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists movements_product_idx on movements (product_id, created_at desc)`,
  `create index if not exists movements_created_idx on movements (created_at desc)`,
  `create table if not exists audit_log (
    id text primary key,
    user_id text,
    user_name text,
    action text not null,
    entity text not null,
    entity_id text,
    detail text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists audit_created_idx on audit_log (created_at desc)`,
];

function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database configured. Set DATABASE_URL to a Postgres connection string."
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForDb.sfPool) {
    const url = connectionString();
    globalForDb.sfPool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      ssl: /localhost|127\.0\.0\.1/i.test(url)
        ? undefined
        : { rejectUnauthorized: false },
    });
    globalForDb.sfPool.on("error", () => {
      /* keep the pool alive on idle client errors */
    });
  }
  return globalForDb.sfPool;
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [918273645]);
    for (const statement of SCHEMA) {
      await client.query(statement);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function ensureSchema(): Promise<void> {
  if (!globalForDb.sfSchema) {
    globalForDb.sfSchema = migrate().catch((error) => {
      globalForDb.sfSchema = undefined;
      throw error;
    });
  }
  return globalForDb.sfSchema;
}

export async function query<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

export async function one<T>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
