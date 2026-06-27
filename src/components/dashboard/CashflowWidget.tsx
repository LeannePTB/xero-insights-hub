import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCashflow } from "@/lib/xero/cashflow.functions";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
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

function startOfFiscalYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}
function today() {
  return new Date();
}

export function CashflowWidget({
  tenantId,
  tenantName,
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
}) {
  const fetchCashflow = useServerFn(getCashflow);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const storageKey = `cashflow-range:${tenantId}`;
  const [fromDate, setFromDate] = usePersistedDate(`${storageKey}:from`, startOfFiscalYear);
  const [toDate, setToDate] = usePersistedDate(`${storageKey}:to`, today);

  const fromStr = toISO(fromDate);
  const toStr = toISO(toDate);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-cashflow", tenantId, fromStr, toStr],
    queryFn: () => fetchCashflow({ data: { tenantId, fromDate: fromStr, toDate: toStr } }),
    enabled: shouldLoad,
    retry: false,
  });

  const netTone =
    data && data.netMovement > 0 ? "text-emerald-600" : data && data.netMovement < 0 ? "text-rose-600" : "text-muted-foreground";
  const NetIcon = data && data.netMovement > 0 ? TrendingUp : data && data.netMovement < 0 ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold">Cash Flow</h3>
            <BasisBadge basis="cash" />
          </div>
          <p className="text-xs text-muted-foreground">
            {fromStr} → {toStr}
          </p>
        </div>
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

      <DateRangeControls
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
      />

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load Cash Flow"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading cash flow…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      ) : data ? (
        <>
          {/* Current cash position */}
          <div className="mt-6 rounded-lg border border-border/60 bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current cash position
                </p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight tabular-nums">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  {fmt(data.totalCash)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  as at {data.asOf} · {data.accounts.length} bank{" "}
                  {data.accounts.length === 1 ? "account" : "accounts"}
                </p>
              </div>
            </div>
            {data.accounts.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Per-account balances
                </summary>
                <div className="mt-2 space-y-1">
                  {data.accounts.map((acc) => (
                    <div
                      key={acc.accountId}
                      className="grid grid-cols-[1fr_5rem] gap-3 text-xs"
                    >
                      <span className="truncate text-muted-foreground">
                        {acc.name}
                        {acc.code ? ` · ${acc.code}` : ""}
                      </span>
                      <span className="text-right font-medium tabular-nums">
                        {fmt(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Period actuals */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Tile label="Money In" value={data.totalIn} tone="text-emerald-600" />
            <Tile label="Money Out" value={data.totalOut} tone="text-rose-600" />
            <Tile
              label="Net movement"
              value={data.netMovement}
              tone={netTone}
              icon={<NetIcon className="h-3 w-3 shrink-0" />}
            />
          </div>

          {data.months.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Monthly breakdown
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Month</th>
                      <th className="py-1 pr-3 text-right font-medium">In</th>
                      <th className="py-1 pr-3 text-right font-medium">Out</th>
                      <th className="py-1 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m) => (
                      <tr key={m.label} className="border-t border-border/40">
                        <td className="py-1 pr-3">{m.label}</td>
                        <td className="py-1 pr-3 text-right tabular-nums text-emerald-600">
                          {fmt(m.moneyIn)}
                        </td>
                        <td className="py-1 pr-3 text-right tabular-nums text-rose-600">
                          {fmt(m.moneyOut)}
                        </td>
                        <td
                          className={`py-1 text-right tabular-nums font-medium ${
                            m.net >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {fmt(m.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Forward projection */}
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              90-day projection
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 text-right font-medium">Expected in</th>
                    <th className="px-3 py-2 text-right font-medium">Expected out</th>
                    <th className="px-3 py-2 text-right font-medium">Net</th>
                    <th className="px-3 py-2 text-right font-medium">Projected cash</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium">Opening</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {fmt(data.totalCash)}
                    </td>
                  </tr>
                  {data.projection.map((b) => (
                    <tr key={b.label} className="border-t border-border/40">
                      <td className="px-3 py-2">{b.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                        {fmt(b.inflow)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                        {fmt(b.outflow)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          b.net >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {fmt(b.net)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          b.closingCash < 0 ? "text-rose-600" : "text-foreground"
                        }`}
                      >
                        {fmt(b.closingCash)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(data.overdueReceivables > 0 || data.overduePayables > 0) && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Includes {fmt(data.overdueReceivables)} overdue receivables and{" "}
                {fmt(data.overduePayables)} overdue payables grouped into the next 30 days.
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Projection based on AR/AP due dates; excludes recurring expenses and one-off
              items not yet invoiced.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 flex items-center gap-1 text-lg font-semibold tracking-tight tabular-nums ${tone}`}>
        {icon}
        {fmt(value)}
      </p>
    </div>
  );
}
