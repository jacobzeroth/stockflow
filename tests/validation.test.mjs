import test from "node:test";
import assert from "node:assert/strict";
import {
  isIsoDate,
  resolveDateRange,
  parseWholeNumber,
  parseOptionalMoney,
  parseMoney,
  parseImportNumbers,
} from "../lib/validation.ts";

test("isIsoDate accepts real calendar dates", () => {
  assert.equal(isIsoDate("2026-11-17"), true);
  assert.equal(isIsoDate("2024-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("2026-00-10"), false);
  assert.equal(isIsoDate("17-11-2026"), false);
  assert.equal(isIsoDate(""), false);
  assert.equal(isIsoDate("2026-11-17' or 1=1"), false);
});

test("resolveDateRange defaults to the last 30 days", () => {
  const range = resolveDateRange(undefined, undefined, new Date("2026-11-17T09:00:00Z"));
  assert.equal(range.from, "2026-10-18");
  assert.equal(range.to, "2026-11-17");
  assert.equal(range.error, undefined);
});

test("resolveDateRange rejects junk instead of sending it to Postgres", () => {
  const range = resolveDateRange("not-a-date", "2026-02-30", new Date("2026-11-17T09:00:00Z"));
  assert.equal(range.from, "2026-10-18");
  assert.equal(range.to, "2026-11-17");
  assert.match(range.error, /adjusted/i);
});

test("resolveDateRange swaps reversed dates", () => {
  const range = resolveDateRange("2026-11-10", "2026-11-01", new Date("2026-11-17T09:00:00Z"));
  assert.equal(range.from, "2026-11-01");
  assert.equal(range.to, "2026-11-10");
  assert.match(range.error, /reversed/);
});

test("parseWholeNumber accepts whole values and rejects decimals", () => {
  assert.deepEqual(parseWholeNumber("12"), { ok: true, value: 12 });
  assert.deepEqual(parseWholeNumber("0", { min: 0 }), { ok: true, value: 0 });
  assert.equal(parseWholeNumber("1.5").ok, false);
  assert.equal(parseWholeNumber("abc").ok, false);
  assert.equal(parseWholeNumber("").ok, false);
  assert.equal(parseWholeNumber("-2", { min: 1 }).ok, false);
  assert.equal(parseWholeNumber("1000001").ok, false);
});

test("parseOptionalMoney keeps blank receipts null", () => {
  assert.deepEqual(parseOptionalMoney(""), { ok: true, value: null });
  assert.deepEqual(parseOptionalMoney("  "), { ok: true, value: null });
  assert.deepEqual(parseOptionalMoney("12.50"), { ok: true, value: 12.5 });
  assert.deepEqual(parseOptionalMoney("0"), { ok: true, value: 0 });
  assert.equal(parseOptionalMoney("-1").ok, false);
  assert.equal(parseOptionalMoney("12.345").ok, false);
  assert.equal(parseOptionalMoney("abc").ok, false);
});

test("parseMoney treats blank product prices as zero", () => {
  assert.deepEqual(parseMoney("", "Unit cost"), { ok: true, value: 0 });
  assert.equal(parseMoney("nope", "Unit cost").ok, false);
});

test("parseImportNumbers validates every numeric column", () => {
  const ok = parseImportNumbers({
    unit_cost: "1.25",
    unit_price: "",
    reorder_level: "4",
    opening_stock: "",
  });
  assert.deepEqual(ok, {
    ok: true,
    value: { unitCost: 1.25, unitPrice: 0, reorderLevel: 4, openingStock: 0 },
  });

  assert.equal(parseImportNumbers({ unit_cost: "abc" }).ok, false);
  assert.equal(parseImportNumbers({ unit_price: "-2" }).ok, false);
  assert.equal(parseImportNumbers({ opening_stock: "2.5" }).ok, false);
  assert.equal(parseImportNumbers({ reorder_level: "lots" }).ok, false);
});
