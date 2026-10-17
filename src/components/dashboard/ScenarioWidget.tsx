import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
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
import { UnclassifiedNotice } from "@/components/dashboard/UnclassifiedNotice";

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
    queryFn: () => staggered(() => fetchScenario({ data: { clientId, tenantId, fromDate: fromStr, toDate: toStr } })),
    enabled: shouldLoad,
    ...xeroQueryRetry,
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
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Cash flow scenario" icon={<SlidersHorizontal className="h-4 w-4"/>} description={`Invoices and expenses for ${monthLabelOf(month)}`} status={<p className="mt-1.5 text-xs text-muted-foreground">Figures for the selected period</p>} isFetching={isFetching} actions={<><Button variant="ghost" size="icon-sm" onClick={() => { setShouldLoad(true); refetch(); }} disabled={isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}/></Button><Button variant="outline" size="sm" asChild><Link to="/clients/$clientId/cashflow-scenario" params={{clientId}} search={{tenantId}}>Open <ArrowRight className="h-3.5 w-3.5"/></Link></Button></>}/>

      <div className="mt-4">
        <MonthPicker value={month} onChange={setMonth} />
      </div>


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
            <Stat label="Baseline (all invoices, excl. GST)" value={fmt(view.rangeTotals.baselineRevenue)} />
            <Stat label="Current scenario" value={fmt(view.rangeTotals.revenue)} />
            <Stat
              label="Difference"
              value={fmt(-view.rangeTotals.excludedRevenue)}
              tone={view.rangeTotals.excludedRevenue > 0 ? "text-rose-600" : "text-muted-foreground"}
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat
              label={`Net position · ${monthLabelOf(month)}`}
              value={fmt(view.monthTotals.net)}
              tone={view.monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
            <Stat label="Cost of sales" value={fmt(view.monthTotals.cogs)} />
            <Stat label="Operating expenses" value={fmt(view.monthTotals.operating)} />
          </div>

          <UnclassifiedNotice clientId={clientId} count={data?.unclassifiedCount ?? 0} names={data?.unclassifiedNames} />




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
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-normal tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
