import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { CheckCircle2, Loader2, PiggyBank, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSuperPayable } from "@/lib/xero/reports.functions";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";

/**
 * Superannuation accrued but not yet paid.
 *
 * Balances come from the accounts the shared statutory resolver identifies as
 * superannuation — the same resolver the activity statement card uses. The card
 * deliberately does NOT claim any individual payday was paid on time: pay-run
 * dates live in Xero's payroll API, which this app does not request.
 */
export function SuperannuationWidget({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const fetchSuper = useServerFn(getSuperPayable);
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);
  const [asAt] = useState<Date>(() => new Date());
  const dateStr = format(asAt, "yyyy-MM-dd");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-super-payable", tenantId, dateStr],
    queryFn: () => fetchSuper({ data: { tenantId, date: dateStr } }),
    retry: false,
  });

  const balance = data ? Math.abs(data.balance) : 0;
  const nothingOutstanding = !!data && Math.abs(data.balance) < 0.005;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-primary" />
              Superannuation owed to employees&apos; funds
            </h3>
            <BasisBadge basis="accrual" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Super accrued and not yet paid, as at {format(asAt, "d MMM yyyy")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : error ? (
        <div className="mt-4">
          <XeroErrorNotice error={error} onRetry={() => refetch()} />
        </div>
      ) : nothingOutstanding ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Nothing outstanding
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              No super is sitting unpaid on this file as at {format(asAt, "d MMM yyyy")}.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <p className="text-xs text-muted-foreground">Super accrued and not yet paid</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{fmt(balance)}</p>
          </div>

          {data && data.lines.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {data.lines.map((l) => (
                <li key={l.name} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm">{l.name}</span>
                  <span className="shrink-0 text-sm tabular-nums">{fmt(Math.abs(l.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Since 1 July 2026, super must reach each employee&apos;s fund within seven business days of
        the payday it relates to, so an amount sitting here longer than that may be overdue.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        This card reads the balance on the superannuation accounts only. It cannot tell whether any
        individual payday was paid on time — that needs pay-run dates from Xero&apos;s payroll data,
        which this dashboard does not read.
      </p>
    </div>
  );
}
