import { cache } from "react";
import { one, query } from "./db";
import { DEFAULT_CURRENCY, isSupportedCurrency } from "./currency";

export type Workspace = {
  name: string;
  currency: string;
};

const FALLBACK_NAME = "Zeroth StockFlow";

function envName(): string {
  return process.env.NEXT_PUBLIC_ORG_NAME?.trim() || FALLBACK_NAME;
}

function envCurrency(): string {
  const value = (process.env.NEXT_PUBLIC_CURRENCY ?? "").trim().toUpperCase();
  return isSupportedCurrency(value) ? value : DEFAULT_CURRENCY;
}

async function readWorkspace(): Promise<Workspace> {
  const existing = await one<Workspace>("select name, currency from workspace where id = 1");
  if (existing) return existing;

  const name = envName();
  const currency = envCurrency();
  await query(
    "insert into workspace (id, name, currency) values (1, $1, $2) on conflict (id) do nothing",
    [name, currency]
  );
  return (
    (await one<Workspace>("select name, currency from workspace where id = 1")) ?? {
      name,
      currency,
    }
  );
}

export const getWorkspace = cache(readWorkspace);

export async function updateWorkspace(name: string, currency: string): Promise<void> {
  await query(
    `insert into workspace (id, name, currency) values (1, $1, $2)
     on conflict (id) do update
       set name = excluded.name, currency = excluded.currency, updated_at = now()`,
    [name, currency]
  );
}
