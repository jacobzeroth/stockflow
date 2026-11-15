"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  hashPassword,
  insertUser,
  passwordProblem,
  requireOwner,
  requireUser,
  requireWriter,
  userCount,
  verifyPassword,
} from "@/lib/auth";
import { newId, one, query, tx } from "@/lib/db";
import { audit, withFlash } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

class ActionError extends Error {}

const text = (form: FormData, key: string): string =>
  String(form.get(key) ?? "").trim();

const integer = (form: FormData, key: string, fallback = 0): number => {
  const value = Number(text(form, key));
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
};

const decimal = (form: FormData, key: string, fallback = 0): number => {
  const value = Number(text(form, key));
  return Number.isFinite(value) ? value : fallback;
};

const money = (value: number): number => Math.round(value * 100) / 100;

function fail(path: string, message: string): never {
  redirect(withFlash(path, "error", message));
}

function done(path: string, message: string): never {
  revalidatePath("/", "layout");
  redirect(withFlash(path, "ok", message));
}

function fromForm(form: FormData, fallback: string): string {
  const value = text(form, "return_to");
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/* ------------------------------------------------------------------ products */

type ProductInput = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number;
  unit_price: number;
  reorder_level: number;
  supplier_id: string | null;
  notes: string | null;
};

type ProductRead =
  | { ok: true; input: ProductInput }
  | { ok: false; error: string };

function readProduct(form: FormData): ProductRead {
  const sku = text(form, "sku");
  const name = text(form, "name");
  if (!sku) return { ok: false, error: "SKU is required." };
  if (name.length < 2) return { ok: false, error: "Product name is required." };
  const unit_cost = decimal(form, "unit_cost");
  const unit_price = decimal(form, "unit_price");
  const reorder_level = integer(form, "reorder_level");
  if (unit_cost < 0 || unit_price < 0) {
    return { ok: false, error: "Cost and price cannot be negative." };
  }
  if (reorder_level < 0) {
    return { ok: false, error: "Reorder level cannot be negative." };
  }
  return {
    ok: true,
    input: {
      sku: sku.toUpperCase(),
      name,
      category: text(form, "category") || "General",
      unit: text(form, "unit") || "unit",
      unit_cost: money(unit_cost),
      unit_price: money(unit_price),
      reorder_level,
      supplier_id: text(form, "supplier_id") || null,
      notes: text(form, "notes") || null,
    },
  };
}

export async function createProductAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const target = fromForm(form, "/products");
  const parsed = readProduct(form);
  if (!parsed.ok) fail(target, parsed.error);
  const input = parsed.input;
  const opening = integer(form, "opening_stock");

  try {
    await tx(async (client) => {
      const id = newId();
      await client.query(
        `insert into products (id, sku, name, category, unit, unit_cost, unit_price, reorder_level, supplier_id, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          input.sku,
          input.name,
          input.category,
          input.unit,
          input.unit_cost,
          input.unit_price,
          input.reorder_level,
          input.supplier_id,
          input.notes,
        ]
      );
      if (opening !== 0) {
        await client.query(
          `insert into movements (id, product_id, kind, quantity, unit_cost, reason, created_by)
           values ($1,$2,'in',$3,$4,'Opening balance',$5)`,
          [newId(), id, Math.abs(opening), input.unit_cost, user.id]
        );
      }
      await audit(client, user, "product.create", "product", id, {
        sku: input.sku,
        opening: Math.abs(opening),
      });
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") fail(target, `SKU ${input.sku} already exists.`);
    fail(target, "Could not create the product. Check the details and try again.");
  }

  done(target, `${input.name} created.`);
}

export async function updateProductAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const id = text(form, "id");
  const target = fromForm(form, `/products/${id}`);
  if (!id) fail("/products", "Missing product.");

  const parsed = readProduct(form);
  if (!parsed.ok) fail(target, parsed.error);
  const input = parsed.input;

  try {
    await tx(async (client) => {
      const result = await client.query(
        `update products set sku=$1, name=$2, category=$3, unit=$4, unit_cost=$5,
                unit_price=$6, reorder_level=$7, supplier_id=$8, notes=$9
          where id=$10`,
        [
          input.sku,
          input.name,
          input.category,
          input.unit,
          input.unit_cost,
          input.unit_price,
          input.reorder_level,
          input.supplier_id,
          input.notes,
          id,
        ]
      );
      if (result.rowCount === 0) throw new ActionError("Product not found.");
      await audit(client, user, "product.update", "product", id, { sku: input.sku });
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") fail(target, `SKU ${input.sku} is already used by another product.`);
    fail(target, error instanceof Error ? error.message : "Could not save changes.");
  }

  done(target, "Product updated.");
}

export async function archiveProductAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const id = text(form, "id");
  const restore = text(form, "restore") === "1";
  const target = fromForm(form, "/products");
  await tx(async (client) => {
    await client.query(
      `update products set archived_at = ${restore ? "null" : "now()"} where id = $1`,
      [id]
    );
    await audit(client, user, restore ? "product.restore" : "product.archive", "product", id);
  });
  done(target, restore ? "Product restored." : "Product archived.");
}

/* ----------------------------------------------------------------- movements */

export async function recordMovementAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const productId = text(form, "product_id");
  const kind = text(form, "kind");
  const target = fromForm(form, "/movements");

  if (!productId) fail(target, "Choose a product.");
  if (kind !== "in" && kind !== "out" && kind !== "adjust") {
    fail(target, "Choose a movement type.");
  }

  const reason = text(form, "reason") || (kind === "in" ? "Stock received" : kind === "out" ? "Stock issued" : "Stock count");
  const reference = text(form, "reference") || null;
  const note = text(form, "note") || null;
  const suppliedCost = decimal(form, "unit_cost", -1);

  try {
    await tx(async (client) => {
      const productResult = await client.query<{
        id: string;
        name: string;
        unit_cost: string;
        reorder_level: number;
      }>(
        "select id, name, unit_cost::float8 as unit_cost, reorder_level from products where id = $1 for update",
        [productId]
      );
      const product = productResult.rows[0];
      if (!product) throw new ActionError("Product not found.");

      const stockResult = await client.query<{ on_hand: number }>(
        "select coalesce(sum(quantity), 0)::int as on_hand from movements where product_id = $1",
        [productId]
      );
      const onHand = Number(stockResult.rows[0]?.on_hand ?? 0);

      let delta = 0;
      let unitCost: number | null = null;

      if (kind === "adjust") {
        const counted = integer(form, "counted", onHand);
        delta = counted - onHand;
        if (delta === 0) {
          throw new ActionError(`Counted quantity matches stock on hand (${onHand}). Nothing to adjust.`);
        }
      } else {
        const quantity = integer(form, "quantity");
        if (quantity <= 0) throw new ActionError("Quantity must be greater than zero.");
        delta = kind === "in" ? quantity : -quantity;
        unitCost = suppliedCost >= 0 ? money(suppliedCost) : Number(product.unit_cost);
      }

      const next = onHand + delta;
      if (next < 0) {
        throw new ActionError(
          `Not enough stock: ${product.name} has ${onHand}, cannot remove ${Math.abs(delta)}.`
        );
      }

      await client.query(
        `insert into movements (id, product_id, kind, quantity, unit_cost, reason, reference, note, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId(),
          productId,
          kind,
          delta,
          unitCost,
          reason,
          reference,
          note,
          user.id,
        ]
      );

      // Weighted average cost on receipts keeps valuation honest.
      if (kind === "in" && unitCost !== null && delta > 0) {
        const incomingValue = delta * unitCost;
        const existingValue = onHand * Number(product.unit_cost);
        const average = (existingValue + incomingValue) / (onHand + delta);
        await client.query("update products set unit_cost = $1 where id = $2", [
          money(average),
          productId,
        ]);
      }

      await audit(client, user, `stock.${kind}`, "product", productId, {
        delta,
        reason,
        reference,
        balance: next,
      });
    });
  } catch (error) {
    fail(target, error instanceof Error ? error.message : "Movement could not be recorded.");
  }

  done(target, "Movement recorded.");
}

/* ----------------------------------------------------------------- suppliers */

export async function saveSupplierAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const id = text(form, "id");
  const target = fromForm(form, "/suppliers");
  const name = text(form, "name");
  if (name.length < 2) fail(target, "Supplier name is required.");

  const values = [
    name,
    text(form, "contact_name") || null,
    text(form, "email") || null,
    text(form, "phone") || null,
    Math.max(integer(form, "lead_time_days", 7), 0),
    text(form, "notes") || null,
  ];

  if (id) {
    await tx(async (client) => {
      await client.query(
        `update suppliers set name=$1, contact_name=$2, email=$3, phone=$4, lead_time_days=$5, notes=$6 where id=$7`,
        [...values, id]
      );
      await audit(client, user, "supplier.update", "supplier", id, { name });
    });
    done(target, "Supplier updated.");
  }

  const newSupplierId = newId();
  await tx(async (client) => {
    await client.query(
      `insert into suppliers (id, name, contact_name, email, phone, lead_time_days, notes)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [newSupplierId, ...values]
    );
    await audit(client, user, "supplier.create", "supplier", newSupplierId, { name });
  });
  done(target, "Supplier added.");
}

export async function archiveSupplierAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const id = text(form, "id");
  const restore = text(form, "restore") === "1";
  await tx(async (client) => {
    await client.query(
      `update suppliers set archived_at = ${restore ? "null" : "now()"} where id = $1`,
      [id]
    );
    await audit(client, user, restore ? "supplier.restore" : "supplier.archive", "supplier", id);
  });
  done("/suppliers", restore ? "Supplier restored." : "Supplier archived.");
}

/* ------------------------------------------------------------------- imports */

export async function importProductsAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const file = form.get("file");
  const target = "/products/import";

  if (!(file instanceof File) || file.size === 0) fail(target, "Choose a CSV file to import.");
  if (file.size > 2 * 1024 * 1024) fail(target, "File is larger than 2 MB.");

  const rows = parseCsv(await file.text());
  if (rows.length < 2) fail(target, "The file needs a header row and at least one product row.");

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const required = ["sku", "name"];
  const missing = required.filter((key) => !header.includes(key));
  if (missing.length) fail(target, `Missing required column(s): ${missing.join(", ")}`);

  const index = (key: string) => header.indexOf(key);
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  await tx(async (client) => {
    const suppliers = await client.query<{ id: string; name: string }>(
      "select id, name from suppliers where archived_at is null"
    );

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const value = (key: string) => (index(key) >= 0 ? (row[index(key)] ?? "").trim() : "");
      const sku = value("sku").toUpperCase();
      const name = value("name");
      if (!sku || !name) {
        errors.push(`Row ${rowIndex + 1}: sku and name are required`);
        continue;
      }

      const supplierName = value("supplier");
      const supplier = supplierName
        ? suppliers.rows.find((s) => s.name.toLowerCase() === supplierName.toLowerCase())
        : undefined;

      const params = [
        name,
        value("category") || "General",
        value("unit") || "unit",
        money(Number(value("unit_cost") || 0)),
        money(Number(value("unit_price") || 0)),
        Math.max(Math.trunc(Number(value("reorder_level") || 0)), 0),
        supplier?.id ?? null,
        value("notes") || null,
      ];

      const existing = await client.query<{ id: string }>(
        "select id from products where lower(sku) = lower($1)",
        [sku]
      );

      if (existing.rowCount) {
        await client.query(
          `update products set name=$1, category=$2, unit=$3, unit_cost=$4, unit_price=$5,
                  reorder_level=$6, supplier_id=$7, notes=$8
            where id=$9`,
          [...params, existing.rows[0].id]
        );
        updated += 1;
      } else {
        const id = newId();
        await client.query(
          `insert into products (id, sku, name, category, unit, unit_cost, unit_price, reorder_level, supplier_id, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, sku, ...params]
        );
        const opening = Math.trunc(Number(value("opening_stock") || 0));
        if (opening > 0) {
          await client.query(
            `insert into movements (id, product_id, kind, quantity, unit_cost, reason, created_by)
             values ($1,$2,'in',$3,$4,'Opening balance (import)',$5)`,
            [newId(), id, opening, params[3], user.id]
          );
        }
        created += 1;
      }

      if (supplierName && !supplier) {
        errors.push(`Row ${rowIndex + 1}: supplier "${supplierName}" not found, left unassigned`);
      }
    }

    await audit(client, user, "product.import", "product", null, { created, updated });
  });

  const summary = `Import finished: ${created} created, ${updated} updated.${
    errors.length ? ` ${errors.length} warning(s) — see below.` : ""
  }`;
  const details = errors.slice(0, 5).join(" · ");
  done(target, details ? `${summary} ${details}` : summary);
}

/* --------------------------------------------------------------------- users */

export async function createUserAction(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const role = text(form, "role");

  if (!name || name.length < 2) fail("/settings", "Enter the team member's name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("/settings", "Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) fail("/settings", problem);
  if (!["owner", "manager", "viewer"].includes(role)) fail("/settings", "Choose a valid role.");

  try {
    const id = await insertUser({ name, email, password, role: role as "owner" | "manager" | "viewer" });
    await audit({ query }, owner, "user.create", "user", id, { email, role });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      fail("/settings", "That email is already in use.");
    }
    fail("/settings", "Could not create the user.");
  }

  done("/settings", `${name} can now sign in.`);
}

export async function changePasswordAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const current = text(form, "current");
  const next = text(form, "password");
  const confirm = text(form, "confirm_password");

  if (next !== confirm) fail("/settings", "New passwords do not match.");
  const problem = passwordProblem(next);
  if (problem) fail("/settings", problem);

  const row = await one<{ password_hash: string }>(
    "select password_hash from users where id = $1",
    [user.id]
  );
  if (!row || !verifyPassword(current, row.password_hash)) {
    fail("/settings", "Current password is incorrect.");
  }

  await query("update users set password_hash = $1 where id = $2", [
    hashPassword(next),
    user.id,
  ]);
  await audit(
    { query },
    user,
    "user.password",
    "user",
    user.id,
    null
  );
  done("/settings", "Password updated.");
}

export async function toggleUserAction(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const id = text(form, "id");
  const active = text(form, "active") === "1";

  if (id === owner.id) fail("/settings", "You cannot deactivate your own account.");
  await query("update users set active = $1 where id = $2", [active, id]);
  await audit({ query }, owner, active ? "user.enable" : "user.disable", "user", id);
  done("/settings", active ? "User re-enabled." : "User deactivated.");
}

/* ------------------------------------------------------------------ demo data */

export async function loadDemoDataAction(): Promise<void> {
  const user = await requireOwner();
  const existing = await one<{ count: string }>("select count(*)::text as count from products");
  if (Number(existing?.count ?? 0) > 0) {
    fail("/settings", "Demo data can only be loaded into an empty catalogue.");
  }

  const suppliers = [
    { name: "Nordic Raw Materials", contact: "Ingrid Holm", email: "orders@nordicraw.example", phone: "+46 8 555 0110", lead: 14 },
    { name: "Vellore Packaging Co.", contact: "S. Ramesh", email: "sales@vellorepack.example", phone: "+91 44 5550 2200", lead: 7 },
    { name: "Ruhr Chemie Handel", contact: "Lena Brandt", email: "vertrieb@ruhrchemie.example", phone: "+49 201 555 330", lead: 21 },
  ];

  await tx(async (client) => {
    const supplierIds = new Map<string, string>();
    for (const supplier of suppliers) {
      const id = newId();
      supplierIds.set(supplier.name, id);
      await client.query(
        `insert into suppliers (id, name, contact_name, email, phone, lead_time_days)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, supplier.name, supplier.contact, supplier.email, supplier.phone, supplier.lead]
      );
    }

    const products = [
      { sku: "RM-CRE-300", name: "Creatine Monohydrate 300 g", category: "Raw material", unit: "jar", cost: 4.2, price: 9.9, reorder: 40, supplier: "Nordic Raw Materials", opening: 60 },
      { sku: "RM-CRE-500", name: "Creatine Monohydrate 500 g", category: "Raw material", unit: "jar", cost: 6.4, price: 14.9, reorder: 30, supplier: "Nordic Raw Materials", opening: 24 },
      { sku: "PK-JAR-500", name: "Jar 500 ml — matte black", category: "Packaging", unit: "piece", cost: 0.68, price: 0, reorder: 200, supplier: "Vellore Packaging Co.", opening: 150 },
      { sku: "PK-LID-500", name: "Lid 500 ml — black", category: "Packaging", unit: "piece", cost: 0.22, price: 0, reorder: 200, supplier: "Vellore Packaging Co.", opening: 420 },
      { sku: "PK-LABEL-U", name: "Label — unflavoured", category: "Packaging", unit: "piece", cost: 0.09, price: 0, reorder: 300, supplier: "Vellore Packaging Co.", opening: 180 },
      { sku: "PK-LABEL-L", name: "Label — lemon mojito", category: "Packaging", unit: "piece", cost: 0.09, price: 0, reorder: 300, supplier: "Vellore Packaging Co.", opening: 90 },
      { sku: "FG-UNF-300", name: "REINPUMP Unflavoured — finished", category: "Finished goods", unit: "unit", cost: 5.1, price: 3.5, reorder: 25, supplier: "Nordic Raw Materials", opening: 18 },
      { sku: "FG-LEM-300", name: "REINPUMP Lemon Mojito — finished", category: "Finished goods", unit: "unit", cost: 5.6, price: 5, reorder: 25, supplier: "Nordic Raw Materials", opening: 6 },
    ];

    for (const product of products) {
      const id = newId();
      await client.query(
        `insert into products (id, sku, name, category, unit, unit_cost, unit_price, reorder_level, supplier_id, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          product.sku,
          product.name,
          product.category,
          product.unit,
          product.cost,
          product.price,
          product.reorder,
          supplierIds.get(product.supplier) ?? null,
          "Sample record — edit or archive freely.",
        ]
      );
      if (product.opening > 0) {
        await client.query(
          `insert into movements (id, product_id, kind, quantity, unit_cost, reason, created_at, created_by)
           values ($1,$2,'in',$3,$4,'Opening balance', now() - interval '40 days', $5)`,
          [newId(), id, product.opening, product.cost, user.id]
        );
      }
    }

    const finished = await client.query<{ id: string; sku: string }>(
      "select id, sku from products where sku like 'FG-%'"
    );
    const labels = await client.query<{ id: string; sku: string }>(
      "select id, sku from products where sku like 'PK-LABEL-%'"
    );

    const movementPlan: { sku: string; kind: string; quantity: number; reason: string; days: number }[] = [
      { sku: "FG-UNF-300", kind: "out", quantity: -8, reason: "Customer orders", days: 18 },
      { sku: "FG-UNF-300", kind: "out", quantity: -5, reason: "Customer orders", days: 9 },
      { sku: "FG-LEM-300", kind: "out", quantity: -4, reason: "Customer orders", days: 6 },
      { sku: "PK-JAR-500", kind: "out", quantity: -30, reason: "Production — filling", days: 12 },
      { sku: "PK-LABEL-U", kind: "out", quantity: -60, reason: "Production — labelling", days: 12 },
      { sku: "PK-LABEL-L", kind: "out", quantity: -40, reason: "Production — labelling", days: 5 },
    ];

    const all = await client.query<{ id: string; sku: string }>("select id, sku from products");
    for (const plan of movementPlan) {
      const product = all.rows.find((row) => row.sku === plan.sku);
      if (!product) continue;
      await client.query(
        `insert into movements (id, product_id, kind, quantity, reason, created_at, created_by)
         values ($1,$2,$3,$4,$5, now() - ($6 || ' days')::interval, $7)`,
        [newId(), product.id, plan.kind, plan.quantity, plan.reason, String(plan.days), user.id]
      );
    }

    await client.query(
      `insert into movements (id, product_id, kind, quantity, reason, created_at, created_by)
       values ($1,$2,'in',120,'Purchase order PO-1042', now() - interval '4 days', $3)`,
      [newId(), labels.rows[0]?.id ?? finished.rows[0]?.id, user.id]
    );

    await audit(client, user, "demo.load", "workspace", null, { products: products.length });
  });

  done("/products", "Sample catalogue loaded. Edit or archive anything you like.");
}

export async function deleteEverythingAction(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const confirmation = text(form, "confirm");
  if (confirmation !== "DELETE") {
    fail("/settings", 'Type DELETE exactly to confirm the wipe.');
  }
  if ((await userCount()) > 1) {
    fail("/settings", "Remove other users before wiping the workspace.");
  }
  await tx(async (client) => {
    await client.query("delete from movements");
    await client.query("delete from products");
    await client.query("delete from suppliers");
    await audit(client, owner, "workspace.reset", "workspace", null);
  });
  done("/settings", "Workspace data removed.");
}
