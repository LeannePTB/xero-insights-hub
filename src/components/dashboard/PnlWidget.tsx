import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";

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



function priorRange(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const priorFrom = new Date(priorTo.getTime() - ms);
  return { from: priorFrom, to: priorTo };
}

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
  const prior = priorRange(fromDate, toDate);
  const priorFromStr = toISO(prior.from);
  const priorToStr = toISO(prior.to);
  const priorLabel = `${format(prior.from, "d MMM yyyy")} – ${format(prior.to, "d MMM yyyy")}`;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromStr, toStr, priorFromStr, priorToStr, basis],
    queryFn: async () => {
      const current = await fetchPnl({ data: { tenantId, fromDate: fromStr, toDate: toStr, widget: "pnl", basis } });
      await wait(1_500);
      const priorReport = await fetchPnl({ data: { tenantId, fromDate: priorFromStr, toDate: priorToStr, widget: "pnl", basis } });
      return { current, prior: priorReport };
    },
    enabled: shouldLoad,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const current = data?.current;
  const priorData = data?.prior;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2"><LineChart className="h-4 w-4 text-primary" />Profit & Loss</h3>
            <BasisBadge basis={basis ?? "accrual"} />
          </div>
          <CardFreshness from={fromDate} to={toDate} source={data?.current.source} isFetching={isFetching} />
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <PeriodSelect value={period} onChange={setPeriod} monthsBack={6} />

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
        <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      ) : current ? (
        <>
          <p className="mt-6 text-[11px] text-muted-foreground">
            Compared with the same length of time immediately before:{" "}
            {format(prior.from, "d MMM yyyy")} to {format(prior.to, "d MMM yyyy")}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Income" value={current.totalIncome} previous={priorData?.totalIncome ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
            <Kpi label="Cost of Sales" value={current.totalCostOfSales} previous={priorData?.totalCostOfSales ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
            <Kpi label="Gross Profit" value={current.grossProfit} previous={priorData?.grossProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
            <Kpi label="Expenses" value={current.totalExpenses} previous={priorData?.totalExpenses ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
            <Kpi label="Net Profit" value={current.netProfit} previous={priorData?.netProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
          </div>
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{fmt(value)}</p>
      <div className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${tone}`}>
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
      <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
        {priorLabel ? `${priorLabel}: ` : "Prior: "}
        {fmt(previous)}
      </p>
    </div>
  );
}
