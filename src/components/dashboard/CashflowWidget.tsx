import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { VectorChart } from "@/components/charts/VectorChart";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCashflow } from "@/lib/xero/cashflow.functions";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import {
  DateRangeControls,
  clearLegacyRangeStorage,
  toISO,
  startOfCurrentMonth,
  today,
} from "@/components/dashboard/DateRangeControls";
import { CardFreshness } from "@/components/dashboard/CardFreshness";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";



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
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  // Range is deliberately not persisted: every page load opens on the
  // default (1st of the current month → today).
  const [fromDate, setFromDate] = useState<Date>(startOfCurrentMonth);
  const [toDate, setToDate] = useState<Date>(today);
  useEffect(clearLegacyRangeStorage, []);

  const fromStr = toISO(fromDate);
  const toStr = toISO(toDate);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-cashflow", tenantId, fromStr, toStr],
    queryFn: () => staggered(() => fetchCashflow({ data: { tenantId, fromDate: fromStr, toDate: toStr } })),
    enabled: shouldLoad,
    ...xeroQueryRetry,
  });

  const netTone =
    data && data.netMovement > 0 ? "text-emerald-600" : data && data.netMovement < 0 ? "text-rose-600" : "text-muted-foreground";
  const NetIcon = data && data.netMovement > 0 ? TrendingUp : data && data.netMovement < 0 ? TrendingDown : Minus;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Cash flow" icon={<Wallet className="h-4 w-4"/>} description="Cash coming in, going out and remaining at bank" badge={<BasisBadge basis="cash"/>} from={fromDate} to={toDate} source={data?.source} isFetching={isFetching} actions={<Button variant="ghost" size="icon-sm" onClick={() => { setShouldLoad(true); refetch(); }} disabled={isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}/></Button>}/>

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
          <div className="mt-6 rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current cash position
                </p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-normal tabular-nums">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  {fmt(data.totalCash)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
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

          <VectorChart title="Monthly money in and out" currency={currency} points={data.months.map(m => ({label:m.label, values:m.complete === false ? [null,null,null] : [m.moneyIn,m.moneyOut,m.net]}))} series={[{label:'Money in',kind:'bar'},{label:'Money out',kind:'bar'},{label:'Net movement',kind:'line'}]} />
          {data.actualsComplete === false && <p className="text-xs text-info">Some months could not be read; period totals are unavailable.</p>}
          {/* Period actuals */}
          {data.actualsComplete !== false && <div className="mt-4 grid grid-cols-3 gap-3">
            <Tile label="Money In" value={data.totalIn} tone="text-emerald-600" currency={currency} />
            <Tile label="Money Out" value={data.totalOut} tone="text-rose-600" currency={currency} />
            <Tile
              label="Net movement"
              value={data.netMovement}
              tone={netTone}
              icon={<NetIcon className="h-3 w-3 shrink-0" />}
              currency={currency}
            />
          </div>

          }
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
                          {m.complete === false ? '—' : fmt(m.moneyIn)}
                        </td>
                        <td className="py-1 pr-3 text-right tabular-nums text-rose-600">
                          {m.complete === false ? '—' : fmt(m.moneyOut)}
                        </td>
                        <td
                          className={`py-1 text-right tabular-nums font-medium ${
                            m.net >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {m.complete === false ? '—' : fmt(m.net)}
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
            <VectorChart title="Projected closing cash" currency={currency} points={[{label:'Now',values:[data.totalCash]}, ...data.projection.map((b,i) => ({label:`Day ${(i+1)*30}`,values:[data.projectionComplete === false ? null : b.closingCash]}))]} series={[{label:'Closing cash',kind:'line'}]} />
            {data.projectionComplete === false && <p className="text-xs text-info">Projection unavailable: the full invoice list could not be read.</p>}
            <details><summary className="mb-2 cursor-pointer text-xs text-link">Projection breakdown</summary>
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
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
                        {data.projectionComplete === false ? '—' : fmt(b.inflow) }
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                        {data.projectionComplete === false ? '—' : fmt(b.outflow) }
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          b.net >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {data.projectionComplete === false ? '—' : fmt(b.net) }
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          b.closingCash < 0 ? "text-rose-600" : "text-foreground"
                        }`}
                      >
                        {data.projectionComplete === false ? '—' : fmt(b.closingCash) }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </details>
            {(data.projectionComplete !== false && (data.overdueReceivables > 0 || data.overduePayables > 0)) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Includes {fmt(data.overdueReceivables)} overdue receivables and{" "}
                {fmt(data.overduePayables)} overdue payables grouped into the next 30 days.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
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
  currency = "AUD",
}: {
  label: string;
  value: number;
  tone: string;
  icon?: React.ReactNode;
  currency?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 flex items-center gap-1 text-lg font-semibold tracking-normal tabular-nums ${tone}`}>
        {icon}
        {formatMoneyExact(value, currency)}
      </p>
    </div>
  );
}
