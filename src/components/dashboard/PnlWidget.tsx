import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss, getPaydayCounts } from "@/lib/xero/reports.functions";
import { sameDaysPreviousMonth, paydayNote } from "@/lib/pnl-comparison";
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StandardHistoryChart } from '@/components/charts/StandardHistoryChart';

import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import {
  PeriodSelect,
  monthRangeFor,
  clearLegacyRangeStorage,
  toISO,
} from "@/components/dashboard/DateRangeControls";
import { CardFreshness } from "@/components/dashboard/CardFreshness";
import { useTenantCurrency, formatMoney } from "@/components/dashboard/useTenantCurrency";



function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PnlWidget({
  tenantId,
  tenantName,
  loadDelayMs = 0,
  basis = "accrual",
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
  basis?: "accrual" | "cash";
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const currency = useTenantCurrency(tenantId);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  // Preset-only period: no free date pickers on this card. Not persisted —
  // every page load opens on the current month to date.
  const [period, setPeriod] = useState<string>("current");
  const { from: fromDate, to: toDate } = monthRangeFor(period);
  useEffect(clearLegacyRangeStorage, []);

  const fromStr = toISO(fromDate);
  const toStr = toISO(toDate);
  const prior = sameDaysPreviousMonth(fromDate, toDate);
  const priorFromStr = toISO(prior.from);
  const priorToStr = toISO(prior.to);
  const priorLabel = prior.from.getMonth() === prior.to.getMonth()
    ? `${format(prior.from, "d")}–${format(prior.to, "d MMM yyyy")}`
    : `${format(prior.from, "d MMM")}–${format(prior.to, "d MMM yyyy")}`;
  const fetchPaydays = useServerFn(getPaydayCounts);
  const paydaysQ = useQuery({
    queryKey: ["pnl-paydays", tenantId, fromStr, toStr, priorFromStr, priorToStr],
    queryFn: () => fetchPaydays({ data: { tenantId, current: [fromStr, toStr], prior: [priorFromStr, priorToStr] } }),
    enabled: shouldLoad,
    staleTime: 30 * 60 * 1000,
  });
  const note = paydayNote(paydaysQ.data?.current ?? null, paydaysQ.data?.prior ?? null);

  const forceLive = useRef(false);
  const { data, isLoading, isFetching, error, refetch: runQuery } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromStr, toStr, priorFromStr, priorToStr, basis],
    queryFn: async () => {
      const refresh = forceLive.current;
      forceLive.current = false;
      const current = await staggered(() => fetchPnl({ data: { tenantId, fromDate: fromStr, toDate: toStr, widget: "pnl", basis, refresh } }));
      // Space live calls out; saved figures need no pause.
      if (current.source?.mode !== "snapshot") await wait(1_500);
      const priorReport = await staggered(() => fetchPnl({ data: { tenantId, fromDate: priorFromStr, toDate: priorToStr, widget: "pnl", basis, refresh } }));
      return { current, prior: priorReport };
    },
    enabled: shouldLoad,
    staleTime: 30 * 60 * 1000,
    ...xeroQueryRetry,
  });

  const current = data?.current;
  const priorData = data?.prior;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Profit & loss" icon={<LineChart className="h-4 w-4"/>} description="Income, expenses and net profit for the selected period" badge={<BasisBadge basis={basis ?? "accrual"}/>} from={fromDate} to={toDate} source={data?.current.source} isFetching={isFetching} stackActions actions={<><PeriodSelect value={period} onChange={setPeriod} monthsBack={6} className="" /><Button variant="ghost" size="icon-sm" onClick={() => { setShouldLoad(true); forceLive.current = true; runQuery(); }} disabled={isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}/></Button></>}/>

      <StandardHistoryChart tenantId={tenantId} card="pnl" currency={currency} basis={basis}/>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load P&L"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading P&L…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => runQuery()} isRetrying={isFetching} />
      ) : current ? (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Compared with {priorLabel}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Income" value={current.totalIncome} previous={priorData?.totalIncome ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
            <Kpi label="Cost of Sales" value={current.totalCostOfSales} previous={priorData?.totalCostOfSales ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
            <Kpi label="Gross Profit" value={current.grossProfit} previous={priorData?.grossProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
            <Kpi label="Expenses" value={current.totalExpenses} previous={priorData?.totalExpenses ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
            <Kpi label="Net Profit" value={current.netProfit} previous={priorData?.netProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
          </div>
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        </>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  previous,
  higherIsBetter,
  currency = "AUD",
  priorLabel,
}: {
  label: string;
  value: number;
  previous: number;
  higherIsBetter: boolean;
  currency?: string;
  priorLabel?: string;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  const delta = value - previous;
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const up = delta > 0;
  const flat = delta === 0;
  const good = flat ? true : up ? higherIsBetter : !higherIsBetter;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const tone = flat ? "text-muted-foreground" : good ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-normal tabular-nums">{fmt(value)}</p>
      <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="tabular-nums">
          {flat ? "No change" : `${up ? "+" : ""}${fmt(delta)}`}
          {pct !== null && !flat && (
            <span className="ml-1 text-muted-foreground">
              ({up ? "+" : ""}{pct.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
        {priorLabel ? `${priorLabel}: ` : "Prior: "}
        {fmt(previous)}
      </p>
    </div>
  );
}
