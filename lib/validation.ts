export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_QUANTITY = 1_000_000;
const MAX_MONEY = 1_000_000_000;

function invalid(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  now: Date = new Date()
): { from: string; to: string; error?: string } {
  const defaultTo = isoDate(now);
  const defaultFrom = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const fromInput = (fromRaw ?? "").trim();
  const toInput = (toRaw ?? "").trim();

  let from = isIsoDate(fromInput) ? fromInput : defaultFrom;
  let to = isIsoDate(toInput) ? toInput : defaultTo;
  const problems: string[] = [];

  if (fromInput && !isIsoDate(fromInput)) problems.push("start date is not a valid date");
  if (toInput && !isIsoDate(toInput)) problems.push("end date is not a valid date");

  if (from > to) {
    [from, to] = [to, from];
    problems.push("dates were reversed");
  }

  return {
    from,
    to,
    error: problems.length
      ? `Date range adjusted: ${problems.join(", ")}. Showing ${from} to ${to}.`
      : undefined,
  };
}

export function parseWholeNumber(
  raw: string,
  options: { min?: number; max?: number; label?: string } = {}
): Parsed<number> {
  const label = options.label ?? "Quantity";
  const min = options.min ?? 0;
  const max = options.max ?? MAX_QUANTITY;
  const value = raw.trim();

  if (!value) return invalid(`${label} is required.`);
  if (!/^-?\d+$/.test(value)) return invalid(`${label} must be a whole number.`);

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return invalid(`${label} is too large.`);
  if (parsed < min) {
    return invalid(
      min === 0 ? `${label} cannot be negative.` : `${label} must be at least ${min}.`
    );
  }
  if (parsed > max) return invalid(`${label} must be ${max.toLocaleString("en-GB")} or less.`);
  return { ok: true, value: parsed };
}

export function parseOptionalMoney(
  raw: string,
  label = "Unit cost"
): Parsed<number | null> {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return invalid(`${label} must be a number with up to 2 decimal places.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return invalid(`${label} cannot be negative.`);
  if (parsed > MAX_MONEY) return invalid(`${label} is too large.`);
  return { ok: true, value: parsed };
}

export function parseMoney(raw: string, label: string): Parsed<number> {
  const value = raw.trim();
  if (!value) return { ok: true, value: 0 };
  return parseOptionalMoney(value, label) as Parsed<number>;
}

export type ImportNumbers = {
  unitCost: number;
  unitPrice: number;
  reorderLevel: number;
  openingStock: number;
};

export function parseImportNumbers(raw: {
  unit_cost?: string;
  unit_price?: string;
  reorder_level?: string;
  opening_stock?: string;
}): Parsed<ImportNumbers> {
  const cost = parseMoney(raw.unit_cost ?? "", "unit_cost");
  if (!cost.ok) return invalid(cost.error);
  const price = parseMoney(raw.unit_price ?? "", "unit_price");
  if (!price.ok) return invalid(price.error);
  const reorder = parseWholeNumber((raw.reorder_level ?? "").trim() || "0", {
    min: 0,
    label: "reorder_level",
  });
  if (!reorder.ok) return invalid(reorder.error);
  const opening = parseWholeNumber((raw.opening_stock ?? "").trim() || "0", {
    min: 0,
    label: "opening_stock",
  });
  if (!opening.ok) return invalid(opening.error);

  return {
    ok: true,
    value: {
      unitCost: cost.value,
      unitPrice: price.value,
      reorderLevel: reorder.value,
      openingStock: opening.value,
    },
  };
}

export function parseEmail(raw: string): Parsed<string> {
  const value = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    return invalid("Enter a valid email address.");
  }
  return { ok: true, value };
}
