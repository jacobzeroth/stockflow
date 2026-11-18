"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  insertUser,
  requireOwner,
  requireUser,
  requireWriter,
  rotateSession,
  userCount,
} from "@/lib/auth";
import { newId, one, query, tx } from "@/lib/db";
import { audit, withFlash } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { recordMovement, StockError } from "@/lib/stock";
import { isSupportedCurrency } from "@/lib/currency";
import { updateWorkspace } from "@/lib/workspace";
import {
  parseImportNumbers,
  parseMoney,
  parseOptionalMoney,
  parseWholeNumber,
} from "@/lib/validation";

class ActionError extends Error {}

const text = (form: FormData, key: string): string =>
  String(form.get(key) ?? "").trim();

const money = (value: number): number => Math.round(value * 100) / 100;

function fail(path: string, message: string): never {
  redirect(withFlash(path, "error", message));
}

function done(path: string, message: string): never {
  revalidatePath("/", "layout");
  redirect(withFlash(path, "ok", message));
}

function safeReturnPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value, "http://stockflow.internal");
    return url.origin === "http://stockflow.internal";
  } catch {
    return false;
  }
}

function fromForm(form: FormData, fallback: string): string {
  const value = text(form, "return_to");
  return safeReturnPath(value) ? value : fallback;
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

  const cost = parseMoney(text(form, "unit_cost"), "Unit cost");
  if (!cost.ok) return { ok: false, error: cost.error };
  const price = parseMoney(text(form, "unit_price"), "Selling price");
  if (!price.ok) return { ok: false, error: price.error };
  const reorder = parseWholeNumber(text(form, "reorder_level") || "0", {
    min: 0,
    label: "Reorder level",
  });
  if (!reorder.ok) return { ok: false, error: reorder.error };

  return {
    ok: true,
    input: {
      sku: sku.toUpperCase(),
      name,
      category: text(form, "category") || "General",
      unit: text(form, "unit") || "unit",
      unit_cost: money(cost.value),
      unit_price: money(price.value),
      reorder_level: reorder.value,
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
  const openingParsed = parseWholeNumber(text(form, "opening_stock") || "0", {
    min: 0,
    label: "Opening stock",
  });
  if (!openingParsed.ok) fail(target, openingParsed.error);
  const opening = openingParsed.value;

  let productId = "";

  try {
    productId = await tx(async (client) => {
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
          [newId(), id, opening, input.unit_cost, user.id]
        );
      }
      await audit(client, user, "product.create", "product", id, {
        sku: input.sku,
        opening,
      });
      return id;
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") fail(target, `SKU ${input.sku} already exists.`);
    fail(target, "Could not create the product. Check the details and try again.");
  }

  done(`/products/${productId}`, `${input.name} created.`);
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
    if (error instanceof ActionError) fail(target, error.message);
    fail(target, "Could not save changes. Check the details and try again.");
  }

  done(target, "Product updated.");
}

export async function archiveProductAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const id = text(form, "id");
  const restore = text(form, "restore") === "1";
  const target = fromForm(form, "/products");
  const updated = await tx(async (client) => {
    const result = await client.query(
      `update products set archived_at = ${restore ? "null" : "now()"} where id = $1`,
      [id]
    );
    if (result.rowCount === 0) return false;
    await audit(client, user, restore ? "product.restore" : "product.archive", "product", id);
    return true;
  });
  if (!updated) fail(target, "Product not found.");
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

  let quantity: number | undefined;
  let counted: number | undefined;

  if (kind === "adjust") {
    const parsed = parseWholeNumber(text(form, "counted"), {
      min: 0,
      label: "Counted quantity",
    });
    if (!parsed.ok) fail(target, parsed.error);
    counted = parsed.value;
  } else {
    const parsed = parseWholeNumber(text(form, "quantity"), {
      min: 1,
      label: "Quantity",
    });
    if (!parsed.ok) fail(target, parsed.error);
    quantity = parsed.value;
  }

  const suppliedCost = parseOptionalMoney(text(form, "unit_cost"));
  if (!suppliedCost.ok) fail(target, suppliedCost.error);

  const reason =
    text(form, "reason") ||
    (kind === "in" ? "Stock received" : kind === "out" ? "Stock issued" : "Stock count");
  const reference = text(form, "reference") || null;
  const note = text(form, "note") || null;
  const requestId = text(form, "request_id") || null;

  let duplicate = false;

  try {
    const result = await tx((client) =>
      recordMovement(client, {
        productId,
        kind,
        quantity,
        counted,
        unitCost: suppliedCost.value,
        reason,
        reference,
        note,
        requestId,
        user: { id: user.id, name: user.name },
      })
    );
    duplicate = result.duplicate;
  } catch (error) {
    if (error instanceof StockError) fail(target, error.message);
    fail(target, "Movement could not be recorded. Try again.");
  }

  done(
    target,
    duplicate ? "This movement was already recorded — no duplicate posted." : "Movement recorded."
  );
}

/* ----------------------------------------------------------------- suppliers */

export async function saveSupplierAction(form: FormData): Promise<void> {
  const user = await requireWriter();
  const id = text(form, "id");
  const target = fromForm(form, "/suppliers");
  const name = text(form, "name");
  if (name.length < 2) fail(target, "Supplier name is required.");

  const email = text(form, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail(target, "Enter a valid supplier email address.");
  }

  const lead = parseWholeNumber(text(form, "lead_time_days") || "7", {
    min: 0,
    max: 365,
    label: "Lead time",
  });
  if (!lead.ok) fail(target, lead.error);

  const values = [
    name,
    text(form, "contact_name") || null,
    email || null,
    text(form, "phone") || null,
    lead.value,
    text(form, "notes") || null,
  ];

  if (id) {
    const updated = await tx(async (client) => {
      const result = await client.query(
        `update suppliers set name=$1, contact_name=$2, email=$3, phone=$4, lead_time_days=$5, notes=$6 where id=$7`,
        [...values, id]
      );
      if (result.rowCount === 0) return false;
      await audit(client, user, "supplier.update", "supplier", id, { name });
      return true;
    });
    if (!updated) fail(target, "Supplier not found.");
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
  const updated = await tx(async (client) => {
    const result = await client.query(
      `update suppliers set archived_at = ${restore ? "null" : "now()"} where id = $1`,
      [id]
    );
    if (result.rowCount === 0) return false;
    await audit(client, user, restore ? "supplier.restore" : "supplier.archive", "supplier", id);
    return true;
  });
  if (!updated) fail("/suppliers", "Supplier not found.");
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

  if (rows.length > 2001) fail(target, "Import at most 2,000 products per file.");

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

      const numbers = parseImportNumbers({
        unit_cost: value("unit_cost"),
        unit_price: value("unit_price"),
        reorder_level: value("reorder_level"),
        opening_stock: value("opening_stock"),
      });
      if (!numbers.ok) {
        errors.push(`Row ${rowIndex + 1}: ${numbers.error}`);
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
        money(numbers.value.unitCost),
        money(numbers.value.unitPrice),
        numbers.value.reorderLevel,
        supplier?.id ?? null,
        value("notes") || null,
      ];

      const existing = await client.query<{ id: string; archived_at: string | null }>(
        "select id, archived_at from products where lower(sku) = lower($1)",
        [sku]
      );

      if (existing.rowCount) {
        if (existing.rows[0].archived_at) {
          errors.push(`Row ${rowIndex + 1}: ${sku} is archived, skipped`);
          continue;
        }
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
        const opening = numbers.value.openingStock;
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
  // Invalidate sessions on other devices, then keep this browser signed in.
  await rotateSession(user.id);
  await audit(
    { query },
    user,
    "user.password",
    "user",
    user.id,
    null
  );
  done("/settings", "Password updated. Other devices have been signed out.");
}

export async function toggleUserAction(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const id = text(form, "id");
  const active = text(form, "active") === "1";

  if (id === owner.id) fail("/settings", "You cannot deactivate your own account.");
  const updated = await one<{ id: string }>(
    "update users set active = $1 where id = $2 returning id",
    [active, id]
  );
  if (!updated) fail("/settings", "User not found.");
  await audit({ query }, owner, active ? "user.enable" : "user.disable", "user", id);
  done("/settings", active ? "User re-enabled." : "User deactivated.");
}

/* --------------------------------------------------------------- workspace */

export async function updateWorkspaceAction(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const name = text(form, "name");
  const currency = text(form, "currency").toUpperCase();

  if (name.length < 2) fail("/settings", "Workspace name must be at least 2 characters.");
  if (name.length > 60) fail("/settings", "Workspace name must be 60 characters or fewer.");
  if (!isSupportedCurrency(currency)) fail("/settings", "Choose a supported currency.");

  await updateWorkspace(name, currency);
  await audit({ query }, owner, "workspace.update", "workspace", null, { name, currency });
  done("/settings", "Workspace updated.");
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
