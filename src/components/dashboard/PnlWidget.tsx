import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BasisSelect, type ReportBasis } from "@/components/dashboard/BasisSelect";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function startOfFiscalYear() {
  const now = new Date();
  // Default to current calendar year-to-date
  return `${now.getFullYear()}-01-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PnlWidget({
  tenantId,
  tenantName,
  defaultBasis = "accrual",
}: {
  tenantId: string;
  tenantName: string;
  defaultBasis?: ReportBasis;
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const fromDate = startOfFiscalYear();
  const toDate = today();
  const [basis, setBasis] = useState<ReportBasis>(defaultBasis);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromDate, toDate, basis],
    queryFn: () => fetchPnl({ data: { tenantId, fromDate, toDate, widget: "pnl", basis } }),
  });

  const expenseData = (data?.expenseLines ?? []).slice(0, 6).map((e) => ({
    name: e.name.length > 18 ? e.name.slice(0, 18) + "…" : e.name,
    amount: e.amount,
  }));
  const maxExpense = Math.max(...expenseData.map((e) => Math.abs(e.amount)), 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold">Profit & Loss · YTD</h3>
          <p className="text-xs text-muted-foreground">
            {fromDate} → {toDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BasisSelect value={basis} onChange={setBasis} disabled={isFetching} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading P&L…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Income" value={data.totalIncome} positive />
            <Kpi label="Expenses" value={data.totalExpenses} positive={false} />
            <Kpi label="Gross Profit" value={data.grossProfit} positive={data.grossProfit >= 0} />
            <Kpi label="Net Profit" value={data.netProfit} positive={data.netProfit >= 0} />
          </div>

          {expenseData.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top expense categories
              </p>
              <div className="space-y-3">
                {expenseData.map((expense) => (
                  <div key={expense.name} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-xs">
                    <span className="truncate text-muted-foreground">{expense.name}</span>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(6, (Math.abs(expense.amount) / maxExpense) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right font-medium">{fmt(expense.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, positive }: { label: string; value: number; positive: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{fmt(value)}</p>
      <p className={`mt-1 flex items-center gap-1 text-[11px] ${positive ? "text-emerald-600" : "text-rose-600"}`}>
        <Icon className="h-3 w-3" />
      </p>
    </div>
  );
}
