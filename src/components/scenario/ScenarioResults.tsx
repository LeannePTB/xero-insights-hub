import { format } from "date-fns";
import type { ProjectionRow } from "@/lib/scenario/adjustments";

const label = (m: string) => format(new Date(`${m}-01T00:00:00`), "MMM yyyy");

/** Baseline vs Scenario, month by month. Every figure is a projection. */
export function ScenarioResults({ rows, fmt, breakEven, title }: {
  rows: ProjectionRow[];
  fmt: (n: number) => string;
  breakEven: { extraCost: number; extraSales: number | null };
  title?: string;
}) {
  const hasCash = rows.some((r) => r.scenario.closingCash !== null);
  return (
    <section aria-label="Baseline vs Scenario" className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title ?? "Compare with baseline"}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">Projection</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Month</th>
              <th className="px-2 py-2 text-right font-semibold">Baseline net</th>
              <th className="px-2 py-2 text-right font-semibold">Scenario net</th>
              <th className="px-2 py-2 text-right font-semibold">Scenario cash movement</th>
              {hasCash && <th className="px-2 py-2 text-right font-semibold">Baseline closing cash</th>}
              {hasCash && <th className="py-2 pl-2 text-right font-semibold">Scenario closing cash</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-border/50">
                <td className="py-2 pr-3">{label(r.month)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(r.baseline.net)}</td>
                <td className={`px-2 py-2 text-right font-semibold tabular-nums ${r.scenario.net < 0 ? "text-destructive" : ""}`}>{fmt(r.scenario.net)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(r.scenario.cashMovement)}</td>
                {hasCash && <td className="px-2 py-2 text-right tabular-nums">{fmt(r.baseline.closingCash ?? 0)}</td>}
                {hasCash && <td className="py-2 pl-2 text-right tabular-nums">{fmt(r.scenario.closingCash ?? 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {breakEven.extraCost > 0.005 && (
        <p className="mt-3 text-sm">
          Extra running costs {fmt(breakEven.extraCost)}/month.{" "}
          {breakEven.extraSales !== null
            ? <>Needs about <span className="font-semibold">{fmt(breakEven.extraSales)}</span> more sales per month to cover this (at the current margin).</>
            : "The margin can't be worked out for this month, so the extra sales needed are not shown."}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Projection: the chosen month repeated forward, with the adjustments applied. Net = income less costs; cash movement also allows for slower payments, one-off items and loans. Closing cash shows only when an opening cash figure is entered.</p>
    </section>
  );
}
