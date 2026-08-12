import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getScenarioData, resetScenario } from "@/lib/xero/scenario.functions";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { formatMoney, useTenantCurrency } from "@/components/dashboard/useTenantCurrency";
import {
  MonthPicker,
  monthBounds,
  monthLabelOf,
  usePersistedMonth,
} from "@/components/dashboard/MonthPicker";
import { buildMatrix, computeTotals } from "@/lib/scenario-calc";

export function ScenarioWidget({
  clientId,
  tenantId,
  tenantName,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
}) {
  const fetchScenario = useServerFn(getScenarioData);
  const reset = useServerFn(resetScenario);
  const qc = useQueryClient();
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoney(n, currency);

  const [month, setMonth] = usePersistedMonth(`scenario-month:${tenantId}`);
  const { from: fromStr, to: toStr } = monthBounds(month);
  const [shouldLoad, setShouldLoad] = useState(true);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["scenario", clientId, tenantId, fromStr, toStr],
    queryFn: () => fetchScenario({ data: { clientId, tenantId, fromDate: fromStr, toDate: toStr } }),
    enabled: shouldLoad,
    retry: false,
  });

  const resetMut = useMutation({
    mutationFn: () => reset({ data: { clientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", clientId] }),
  });

  const view = useMemo(() => {
    if (!data) return null;
    const months = data.months;
    return {
      months,
      matrix: buildMatrix(data.customers, data.invoices, months),
      monthTotals: computeTotals(data.invoices, data.expenses, months[0] ?? month),
      rangeTotals: computeTotals(data.invoices, data.expenses, null),
    };
  }, [data, month]);

  const isEmpty = !!data && data.invoices.length === 0 && data.expenses.length === 0;


  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Cashflow Scenario
          </h3>
          <p className="text-xs text-muted-foreground">
            {fromStr} → {toStr}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShouldLoad(true);
              refetch();
            }}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/clients/$clientId/cashflow-scenario" params={{ clientId }} search={{ tenantId }}>
              Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <DateRangeControls
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
      />

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading from Xero…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      ) : isEmpty ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No invoices or expenses in Xero for this period.
        </p>
      ) : view ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Baseline (all invoices)" value={fmt(view.rangeTotals.baselineRevenue)} />
            <Stat label="Current scenario" value={fmt(view.rangeTotals.revenue)} />
            <Stat
              label="Difference"
              value={fmt(-view.rangeTotals.excludedRevenue)}
              tone={view.rangeTotals.excludedRevenue > 0 ? "text-rose-600" : "text-muted-foreground"}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              label={`Net position · ${monthLabel(currentMonthKey())}`}
              value={fmt(view.monthTotals.net)}
              tone={view.monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
            <Stat
              label="Net position · period"
              value={fmt(view.rangeTotals.net)}
              tone={view.rangeTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
          </div>

          <MiniBars months={view.months} values={view.matrix.columnTotals} fmt={fmt} />

          {view.rangeTotals.excludedRevenue > 0 && (
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
