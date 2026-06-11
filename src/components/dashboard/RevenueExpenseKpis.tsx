import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BasisSelect, type ReportBasis } from "@/components/dashboard/BasisSelect";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function monthRange(offsetMonths: number): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const label = start.toLocaleString(undefined, { month: "short", year: "numeric" });
  return { from: iso(start), to: iso(end), label };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function RevenueExpenseKpis({
  tenantId,
  tenantName,
  defaultBasis = "accrual",
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  defaultBasis?: ReportBasis;
  loadDelayMs?: number;
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const current = monthRange(0);
  const prior = monthRange(-1);
  const [basis, setBasis] = useState<ReportBasis>(defaultBasis);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-pnl-month-comparison", tenantId, current.from, current.to, prior.from, prior.to, basis],
    queryFn: async () => {
      const currentReport = await fetchPnl({
        data: { tenantId, fromDate: current.from, toDate: current.to, widget: "revenue_kpis", basis },
      });
      await wait(1_500);
      const priorReport = await fetchPnl({
        data: { tenantId, fromDate: prior.from, toDate: prior.to, widget: "revenue_kpis", basis },
      });
      return { current: currentReport, prior: priorReport };
    },
    enabled: shouldLoad,
    retry: false,
  });

  function refetch() {
    setShouldLoad(true);
    refetch();
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
            {current.label} vs {prior.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BasisSelect value={basis} onChange={setBasis} disabled={isFetching} />
          <Button variant="ghost" size="sm" onClick={refetch} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

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
        <XeroErrorNotice error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Revenue"
            current={curQ.data?.totalIncome ?? 0}
            previous={prevQ.data?.totalIncome ?? 0}
            higherIsBetter
          />
          <KpiCard
            label="Expenses"
            current={curQ.data?.totalExpenses ?? 0}
            previous={prevQ.data?.totalExpenses ?? 0}
            higherIsBetter={false}
          />
          <KpiCard
            label="Net Profit"
            current={curQ.data?.netProfit ?? 0}
            previous={prevQ.data?.netProfit ?? 0}
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
