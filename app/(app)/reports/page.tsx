import { requireUser } from "@/lib/auth";
import { getReport, listAudit } from "@/lib/data";
import { CardHeader, EmptyState, PageHeader, Stat, money, number, when } from "@/components/ui";

export const dynamic = "force-dynamic";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  await requireUser();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = searchParams.from || isoDate(monthAgo);
  const to = searchParams.to || isoDate(today);

  const [report, audit] = await Promise.all([getReport(from, to), listAudit(12)]);

  const totals = report.valuation.reduce(
    (sum, row) => ({
      units: sum.units + row.units,
      cost: sum.cost + row.cost,
      retail: sum.retail + row.retail,
    }),
    { units: 0, cost: 0, retail: 0 }
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Valuation, throughput and the workspace audit trail">
        <a
          href={`/api/export/movements?from=${from}&to=${to}`}
          className="btn-ghost"
        >
          Movement CSV
        </a>
        <a href="/api/export/products" className="btn-ghost">
          Stock CSV
        </a>
      </PageHeader>

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input id="to" type="date" name="to" defaultValue={to} className="input" />
        </div>
        <button className="btn-ghost" type="submit">
          Apply range
        </button>
        <p className="ml-auto text-xs text-muted">
          Throughput shown for {new Date(from).toLocaleDateString("en-GB")} –{" "}
          {new Date(to).toLocaleDateString("en-GB")}
        </p>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Units received" value={number(report.totalIn)} tone="ok" />
        <Stat label="Units issued" value={number(report.totalOut)} tone="brand" />
        <Stat label="Ledger entries" value={number(report.movementCount)} hint="In selected range" />
        <Stat
          label="Stock value"
          value={money(totals.cost)}
          hint={`${number(report.activeSkus)} SKUs with stock`}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <CardHeader title="Valuation by category" hint="At cost / at retail" />
          {report.valuation.length === 0 ? (
            <EmptyState title="No stock yet" body="Add products and record receipts to build a valuation." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Category</th>
                  <th className="th text-right">Units</th>
                  <th className="th text-right">Cost</th>
                  <th className="th text-right">Retail</th>
                </tr>
              </thead>
              <tbody>
                {report.valuation.map((row) => (
                  <tr key={row.category} className="border-b border-line/60 last:border-0">
                    <td className="td text-white">{row.category}</td>
                    <td className="td text-right tabular-nums text-muted">{number(row.units)}</td>
                    <td className="td text-right tabular-nums">{money(row.cost)}</td>
                    <td className="td text-right tabular-nums text-muted">{money(row.retail)}</td>
                  </tr>
                ))}
                <tr className="bg-panel2/60">
                  <td className="td font-semibold text-white">Total</td>
                  <td className="td text-right font-semibold tabular-nums">{number(totals.units)}</td>
                  <td className="td text-right font-semibold tabular-nums text-white">
                    {money(totals.cost)}
                  </td>
                  <td className="td text-right font-semibold tabular-nums text-muted">
                    {money(totals.retail)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <CardHeader title="Top issued in range" hint="By units" />
          {report.topOut.length === 0 ? (
            <EmptyState title="No issues in this range" body="Issue stock or widen the date range." />
          ) : (
            <ul className="divide-y divide-line/60">
              {report.topOut.map((row) => (
                <li key={row.sku} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-silver">{row.name}</p>
                    <p className="font-mono text-[11px] text-muted">{row.sku}</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm text-[#9db4ff]">
                    −{number(row.units)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-5 overflow-hidden">
        <CardHeader title="Audit trail" hint="Latest activity" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">When</th>
                <th className="th">User</th>
                <th className="th">Action</th>
                <th className="th">Entity</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id} className="border-b border-line/60 last:border-0">
                  <td className="td whitespace-nowrap text-muted">{when(entry.created_at)}</td>
                  <td className="td text-silver">{entry.user_name ?? "system"}</td>
                  <td className="td font-mono text-[11px] text-muted">{entry.action}</td>
                  <td className="td text-muted">{entry.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
