import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../lib/csv.ts";

test("parseCsv handles quoted commas and escaped quotes", () => {
  const rows = parseCsv('sku,name,notes\nA-1,"Bottle, 500 ml","He said ""hi"""\n');
  assert.deepEqual(rows, [
    ["sku", "name", "notes"],
    ["A-1", "Bottle, 500 ml", 'He said "hi"'],
  ]);
});

test("parseCsv strips BOM, handles CRLF and skips blank lines", () => {
  const rows = parseCsv("\uFEFFsku,name\r\nA-1,Widget\r\n\r\nA-2,Gadget");
  assert.deepEqual(rows, [
    ["sku", "name"],
    ["A-1", "Widget"],
    ["A-2", "Gadget"],
  ]);
});

test("toCsv quotes separators and preserves newlines", () => {
  const csv = toCsv([
    ["a", "b"],
    ['x,y', 'line "one"\ntwo'],
  ]);
  assert.equal(csv, 'a,b\r\n"x,y","line ""one""\ntwo"');
});
