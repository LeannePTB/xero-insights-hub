import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getScenario, resetScenario, seedScenarioExamples } from "@/lib/scenario.functions";
import { formatMoney } from "@/components/dashboard/useTenantCurrency";
import {
  buildMatrix,
  computeTotals,
  currentMonthKey,
  monthLabel,
  monthsFrom,
} from "@/lib/scenario-calc";

export function ScenarioWidget({ clientId }: { clientId: string }) {
  const fetchScenario = useServerFn(getScenario);
  const seed = useServerFn(seedScenarioExamples);
  const reset = useServerFn(resetScenario);
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["scenario", clientId],
    queryFn: () => fetchScenario({ data: { clientId } }),
    retry: false,
  });

  const resetMut = useMutation({
    mutationFn: () => reset({ data: { clientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", clientId] }),
  });

  const view = useMemo(() => {
    if (!data) return null;
    const months = monthsFrom(data.invoices, data.expenses).slice(-6);
    const matrix = buildMatrix(data.customers, data.invoices, months);
    const month = currentMonthKey();
    return {
      months,
      matrix,
      monthTotals: computeTotals(data.invoices, data.expenses, month),
      yearTotals: computeTotals(data.invoices, data.expenses, null),
    };
  }, [data]);

  const fmt = (n: number) => formatMoney(n, data?.currency ?? "AUD");
  const isEmpty = !!data && data.invoices.length === 0 && data.expenses.length === 0;

  async function handleSeed() {
    setSeeding(true);
    try {
      await seed({ data: { clientId } });
      await qc.invalidateQueries({ queryKey: ["scenario", clientId] });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Cashflow Scenario
          </h3>
          <p className="text-xs text-muted-foreground">Money in vs money out, with what-if exclusions</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/clients/$clientId/cashflow-scenario" params={{ clientId }}>
            Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading scenario…
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>
      ) : isEmpty ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No scenario data yet.</p>
          <Button className="mt-3" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add example data
          </Button>
        </div>
      ) : view ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Baseline (all invoices)" value={fmt(view.yearTotals.baselineRevenue)} />
            <Stat label="Current scenario" value={fmt(view.yearTotals.revenue)} />
            <Stat
              label="Difference"
              value={fmt(-view.yearTotals.excludedRevenue)}
              tone={view.yearTotals.excludedRevenue > 0 ? "text-rose-600" : "text-muted-foreground"}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label={`Net position · ${monthLabel(currentMonthKey())}`} value={fmt(view.monthTotals.net)} tone={view.monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"} />
            <Stat label="Net position · all months" value={fmt(view.yearTotals.net)} tone={view.yearTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"} />
          </div>

          <MiniBars months={view.months} values={view.matrix.columnTotals} fmt={fmt} />

          {view.yearTotals.excludedRevenue > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset scenario
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function MiniBars({ months, values, fmt }: { months: string[]; values: number[]; fmt: (n: number) => string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Revenue by month
      </p>
      <div className="flex h-24 items-end gap-2">
        {months.map((m, i) => (
          <div key={m} className="flex flex-1 flex-col items-center gap-1" title={fmt(values[i] ?? 0)}>
            <div
              className="w-full rounded-t bg-primary/80"
              style={{ height: `${Math.max(2, ((values[i] ?? 0) / max) * 100)}%` }}
            />
            <span className="text-[10px] text-muted-foreground">{monthLabel(m)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
