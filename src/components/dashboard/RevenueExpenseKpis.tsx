import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import {
  DateRangeControls,
  toISO,
  usePersistedDate,
} from "@/components/dashboard/DateRangeControls";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function startOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function rangeLabel(from: Date, to: Date) {
  const sameMonth =
    from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  if (sameMonth) {
    return from.toLocaleString(undefined, { month: "short", year: "numeric" });
  }
  return `${toISO(from)} → ${toISO(to)}`;
}

function priorRange(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const priorFrom = new Date(priorTo.getTime() - ms);
  return { from: priorFrom, to: priorTo };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function RevenueExpenseKpis({
  tenantId,
  tenantName,
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const storageKey = `revenue-kpis-range:${tenantId}`;
  const [fromDate, setFromDate] = usePersistedDate(`${storageKey}:from`, startOfThisMonth);
  const [toDate, setToDate] = usePersistedDate(`${storageKey}:to`, endOfThisMonth);

  const currentFromStr = toISO(fromDate);
  const currentToStr = toISO(toDate);
  const prior = priorRange(fromDate, toDate);
  const priorFromStr = toISO(prior.from);
  const priorToStr = toISO(prior.to);

  const { data, isLoading, isFetching, error, refetch: refetchReports } = useQuery({
    queryKey: ["xero-pnl-month-comparison", tenantId, currentFromStr, currentToStr, priorFromStr, priorToStr, "accrual"],
    queryFn: async () => {
      const currentReport = await fetchPnl({
        data: { tenantId, fromDate: currentFromStr, toDate: currentToStr, widget: "revenue_kpis", basis: "accrual" },
      });
      await wait(1_500);
      const priorReport = await fetchPnl({
        data: { tenantId, fromDate: priorFromStr, toDate: priorToStr, widget: "revenue_kpis", basis: "accrual" },
      });
      return { current: currentReport, prior: priorReport };
    },
    enabled: shouldLoad,
    retry: false,
  });

  function handleRefetch() {
    setShouldLoad(true);
    refetchReports();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold">Revenue & Expenses</h3>
          <p className="text-xs text-muted-foreground">
            {rangeLabel(fromDate, toDate)} vs {rangeLabel(prior.from, prior.to)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefetch} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <DateRangeControls
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
      />

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load KPIs"
          description="Load this card only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading KPIs…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={handleRefetch} isRetrying={isFetching} />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Revenue"
            current={data?.current.totalIncome ?? 0}
            previous={data?.prior.totalIncome ?? 0}
            higherIsBetter
          />
          <KpiCard
            label="Expenses"
            current={data?.current.totalExpenses ?? 0}
            previous={data?.prior.totalExpenses ?? 0}
            higherIsBetter={false}
          />
          <KpiCard
            label="Net Profit"
            current={data?.current.netProfit ?? 0}
            previous={data?.prior.netProfit ?? 0}
            higherIsBetter
          />
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  current,
  previous,
  higherIsBetter,
}: {
  label: string;
  current: number;
  previous: number;
  higherIsBetter: boolean;
}) {
  const delta = current - previous;
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const up = delta > 0;
  const flat = delta === 0;
  const good = flat ? true : (up ? higherIsBetter : !higherIsBetter);
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const tone = flat
    ? "text-muted-foreground"
    : good
    ? "text-emerald-600"
    : "text-rose-600";

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{fmt(current)}</p>
      <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        <span>
          {flat ? "No change" : `${up ? "+" : ""}${fmt(delta)}`}
          {pct !== null && !flat && (
            <span className="ml-1 text-muted-foreground">
              ({up ? "+" : ""}{pct.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Prior: {fmt(previous)}</p>
    </div>
  );
}
