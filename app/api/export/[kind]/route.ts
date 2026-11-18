import { getCurrentUser } from "@/lib/auth";
import { getReorderGroups, listMovements, listProducts } from "@/lib/data";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const dec2 = (value: number): string => value.toFixed(2);

const TEMPLATE = [
  ["sku", "name", "category", "unit", "unit_cost", "unit_price", "reorder_level", "supplier", "opening_stock", "notes"],
  ["RM-CRE-300", "Creatine Monohydrate 300 g", "Raw material", "jar", "4.20", "9.90", "40", "Nordic Raw Materials", "60", ""],
  ["PK-JAR-500", "Jar 500 ml — matte black", "Packaging", "piece", "0.68", "0", "200", "Vellore Packaging Co.", "150", ""],
];

function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Sign in to export data.", { status: 401 });
  }

  const url = new URL(request.url);
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === "template") {
    return csvResponse(toCsv(TEMPLATE), "stockflow-import-template.csv");
  }

  if (kind === "products") {
    const products = await listProducts({
      search: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      includeArchived: true,
    });
    const rows: (string | number | null)[][] = [
      [
        "sku",
        "name",
        "category",
        "unit",
        "on_hand",
        "reorder_level",
        "unit_cost",
        "unit_price",
        "stock_value",
        "supplier",
        "archived",
      ],
      ...products.map((product) => [
        product.sku,
        product.name,
        product.category,
        product.unit,
        product.on_hand,
        product.reorder_level,
        dec2(product.unit_cost),
        dec2(product.unit_price),
        dec2(product.on_hand * product.unit_cost),
        product.supplier_name ?? "",
        product.archived_at ? "yes" : "no",
      ]),
    ];
    return csvResponse(toCsv(rows), `stockflow-products-${stamp}.csv`);
  }

  if (kind === "movements") {
    const movements = await listMovements({
      productId: url.searchParams.get("product") || undefined,
      kind: url.searchParams.get("kind") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      limit: 1000,
    });
    const rows: (string | number | null)[][] = [
      ["date", "sku", "product", "type", "change", "unit", "unit_cost", "reason", "reference", "note", "user"],
      ...movements.map((movement) => [
        new Date(movement.created_at).toISOString(),
        movement.product_sku,
        movement.product_name,
        movement.kind,
        movement.quantity,
        movement.unit,
        movement.unit_cost ?? "",
        movement.reason ?? "",
        movement.reference ?? "",
        movement.note ?? "",
        movement.created_by_name ?? "",
      ]),
    ];
    return csvResponse(toCsv(rows), `stockflow-movements-${stamp}.csv`);
  }

  if (kind === "reorder") {
    const groups = await getReorderGroups();
    const rows: (string | number | null)[][] = [
      ["supplier", "contact", "email", "sku", "product", "on_hand", "reorder_level", "suggested_qty", "unit", "unit_cost", "line_total"],
      ...groups.flatMap((group) =>
        group.items.map((item) => [
          group.supplier.name,
          group.supplier.contact_name ?? "",
          group.supplier.email ?? "",
          item.product.sku,
          item.product.name,
          item.product.on_hand,
          item.product.reorder_level,
          item.suggested,
          item.product.unit,
          dec2(item.product.unit_cost),
          dec2(item.suggested * item.product.unit_cost),
        ])
      ),
    ];
    return csvResponse(toCsv(rows), `stockflow-reorder-${stamp}.csv`);
  }

  return new Response("Unknown export.", { status: 404 });
}
