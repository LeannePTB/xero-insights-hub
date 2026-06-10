import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { Loader2, Target, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function startOfFiscalYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function BreakevenWidget({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const fromDate = startOfFiscalYear();
  const toDate = today();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromDate, toDate],
    queryFn: () => fetchPnl({ data: { tenantId, fromDate, toDate } }),
  });

  const income = data?.totalIncome ?? 0;
  const cogs = data?.totalCostOfSales ?? 0;
  const opex = data?.totalExpenses ?? 0;
  const grossMargin = income > 0 ? (income - cogs) / income : 0;
  const breakevenRevenue = grossMargin > 0 ? opex / grossMargin : 0;
  const surplus = income - breakevenRevenue;
  const coverage = breakevenRevenue > 0 ? income / breakevenRevenue : 0;
  const progress = breakevenRevenue > 0 ? Math.min(100, (income / breakevenRevenue) * 100) : 0;
  const aboveBreakeven = surplus >= 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Breakeven · YTD
          </h3>
          <p className="text-xs text-muted-foreground">
            {fromDate} → {toDate}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating breakeven…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : data ? (
        income <= 0 || grossMargin <= 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Not enough income or positive gross margin to compute a breakeven. Once you have sales
              exceeding cost of sales, this will calculate the revenue needed to cover operating expenses.
            </span>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Breakeven Revenue" value={fmt(breakevenRevenue)} />
              <Kpi label="Gross Margin" value={pct(grossMargin)} />
              <Kpi label="Fixed Costs" value={fmt(opex)} />
              <Kpi
                label={aboveBreakeven ? "Surplus" : "Shortfall"}
                value={fmt(Math.abs(surplus))}
                tone={aboveBreakeven ? "positive" : "negative"}
              />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Progress to breakeven
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  {coverage.toFixed(2)}× covered
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                    aboveBreakeven ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
                <div className="absolute inset-y-0 right-0 w-px bg-foreground/30" />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>Income: {fmt(income)}</span>
                <span>Target: {fmt(breakevenRevenue)}</span>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-muted-foreground">
              Breakeven = Operating Expenses ÷ Gross Margin. Cost of Sales is treated as variable;
              all other operating expenses are treated as fixed.
            </p>
          </>
        )
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
