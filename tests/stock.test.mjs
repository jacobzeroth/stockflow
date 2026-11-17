import test from "node:test";
import assert from "node:assert/strict";
import { weightedAverageCost } from "../lib/stock.ts";

test("weighted average blends existing stock with the receipt", () => {
  assert.equal(weightedAverageCost(10, 5, 10, 2), 3.5);
  assert.equal(weightedAverageCost(0, 0, 5, 4.2), 4.2);
  assert.equal(weightedAverageCost(3, 2.5, 1, 2.5), 2.5);
});

test("weighted average rounds to two decimals and is stable for empty stock", () => {
  assert.equal(weightedAverageCost(3, 1, 1, 2), 1.25);
  assert.equal(weightedAverageCost(2, 1, 1, 2), 1.33);
  assert.equal(weightedAverageCost(0, 0, 0, 9), 0);
});
