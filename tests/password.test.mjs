import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, passwordProblem } from "../lib/password.ts";

test("passwords hash with a salt and verify", () => {
  const first = hashPassword("TestPassword9x");
  const second = hashPassword("TestPassword9x");

  assert.notEqual(first, second, "each hash uses a fresh salt");
  assert.match(first, /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(verifyPassword("TestPassword9x", first), true);
  assert.equal(verifyPassword("wrong-password1", first), false);
  assert.equal(verifyPassword("TestPassword9x", second), true);
});

test("malformed hashes fail closed", () => {
  assert.equal(verifyPassword("anything", ""), false);
  assert.equal(verifyPassword("anything", "plaintext"), false);
  assert.equal(verifyPassword("anything", "scrypt$1$2$3$salt$zz"), false);
  assert.equal(verifyPassword("anything", "bcrypt$1$2$3$salt$hash"), false);
});

test("password policy requires length, letters and numbers", () => {
  assert.match(passwordProblem("short1"), /at least 12/);
  assert.match(passwordProblem("founder123"), /at least 12/);
  assert.match(passwordProblem("alllettersonly"), /letters and numbers/);
  assert.match(passwordProblem("123456789012"), /letters and numbers/);
  assert.equal(passwordProblem("TestPassword9x"), null);
});
