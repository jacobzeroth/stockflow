import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "stock ledger integration against Postgres",
  { skip: databaseUrl ? false : "Set TEST_DATABASE_URL to run database tests." },
  async (t) => {
    process.env.DATABASE_URL = databaseUrl;

    const { ensureSchema, getPool, tx } = await import("../lib/db.ts");
    const { recordMovement, StockError } = await import("../lib/stock.ts");

    await ensureSchema();
    const pool = getPool();

    const suffix = crypto.randomUUID().slice(0, 8);
    const userId = crypto.randomUUID();
    const productIds = [];

    await pool.query(
      "insert into users (id, email, name, password_hash, role) values ($1,$2,$3,$4,$5)",
      [userId, `runner-${suffix}@stockflow.test`, "Test runner", "x", "manager"]
    );

    async function makeProduct(openingStock = 0, unitCost = 0) {
      const id = crypto.randomUUID();
      productIds.push(id);
      await pool.query(
        `insert into products (id, sku, name, category, unit, unit_cost, reorder_level)
         values ($1,$2,$3,'Testing','unit',$4,2)`,
        [id, `TEST-${suffix}-${productIds.length}`, `Test product ${productIds.length}`, unitCost]
      );
      if (openingStock > 0) {
        await pool.query(
          `insert into movements (id, product_id, kind, quantity, unit_cost, reason, created_by)
           values ($1,$2,'in',$3,$4,'Opening balance',$5)`,
          [crypto.randomUUID(), id, openingStock, unitCost, userId]
        );
      }
      return id;
    }

    async function onHand(productId) {
      const result = await pool.query(
        "select coalesce(sum(quantity), 0)::int as qty from movements where product_id = $1",
        [productId]
      );
      return Number(result.rows[0].qty);
    }

    async function productCost(productId) {
      const result = await pool.query(
        "select unit_cost::float8 as cost from products where id = $1",
        [productId]
      );
      return Number(result.rows[0].cost);
    }

    const actor = { id: userId, name: "Test runner" };

    t.after(async () => {
      await pool.query("delete from audit_log where entity_id = any($1::text[])", [productIds]);
      await pool.query("delete from products where id = any($1::text[])", [productIds]);
      await pool.query("delete from users where id = $1", [userId]);
      await pool.end();
    });

    await t.test("receive, issue and count update the ledger", async () => {
      const productId = await makeProduct(0, 3);

      const receipt = await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "in",
          quantity: 10,
          unitCost: 5,
          reason: "Purchase",
          requestId: crypto.randomUUID(),
          user: actor,
        })
      );
      assert.equal(receipt.balance, 10);
      assert.equal(await onHand(productId), 10);
      assert.equal(await productCost(productId), 5);

      await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "out",
          quantity: 3,
          reason: "Sale",
          requestId: crypto.randomUUID(),
          user: actor,
        })
      );
      assert.equal(await onHand(productId), 7);

      const counted = await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "adjust",
          counted: 6,
          reason: "Stock count",
          requestId: crypto.randomUUID(),
          user: actor,
        })
      );
      assert.equal(counted.delta, -1);
      assert.equal(await onHand(productId), 6);
    });

    await t.test("blank receipt cost keeps the weighted average", async () => {
      const productId = await makeProduct(0, 3);

      await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "in",
          quantity: 10,
          unitCost: 5,
          reason: "First receipt",
          requestId: crypto.randomUUID(),
          user: actor,
        })
      );
      await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "in",
          quantity: 10,
          unitCost: null,
          reason: "Second receipt, no cost entered",
          requestId: crypto.randomUUID(),
          user: actor,
        })
      );

      assert.equal(await onHand(productId), 20);
      assert.equal(await productCost(productId), 5);
    });

    await t.test("concurrent issues cannot oversell", async () => {
      const productId = await makeProduct(10, 2);

      const attempts = await Promise.allSettled([
        tx((client) =>
          recordMovement(client, {
            productId,
            kind: "out",
            quantity: 6,
            reason: "Concurrent A",
            requestId: crypto.randomUUID(),
            user: actor,
          })
        ),
        tx((client) =>
          recordMovement(client, {
            productId,
            kind: "out",
            quantity: 6,
            reason: "Concurrent B",
            requestId: crypto.randomUUID(),
            user: actor,
          })
        ),
      ]);

      const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
      const rejected = attempts.filter((attempt) => attempt.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.ok(rejected[0].reason instanceof StockError);
      assert.match(rejected[0].reason.message, /Not enough stock/);
      assert.equal(await onHand(productId), 4);
    });

    await t.test("a replayed request id does not duplicate the ledger", async () => {
      const productId = await makeProduct(0, 1);
      const requestId = crypto.randomUUID();

      const first = await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "in",
          quantity: 5,
          unitCost: 1,
          reason: "Receive",
          requestId,
          user: actor,
        })
      );
      const second = await tx((client) =>
        recordMovement(client, {
          productId,
          kind: "in",
          quantity: 5,
          unitCost: 1,
          reason: "Receive",
          requestId,
          user: actor,
        })
      );

      assert.equal(first.duplicate, false);
      assert.equal(second.duplicate, true);
      assert.equal(await onHand(productId), 5);

      const count = await pool.query(
        "select count(*)::int as count from movements where product_id = $1 and request_id = $2",
        [productId, requestId]
      );
      assert.equal(count.rows[0].count, 1);
    });

    await t.test("archived products reject movements", async () => {
      const productId = await makeProduct(5, 1);
      await pool.query("update products set archived_at = now() where id = $1", [productId]);

      await assert.rejects(
        tx((client) =>
          recordMovement(client, {
            productId,
            kind: "out",
            quantity: 1,
            reason: "Should fail",
            requestId: crypto.randomUUID(),
            user: actor,
          })
        ),
        /archived/
      );
      assert.equal(await onHand(productId), 5);

      await pool.query("update products set archived_at = null where id = $1", [productId]);
    });
  }
);
