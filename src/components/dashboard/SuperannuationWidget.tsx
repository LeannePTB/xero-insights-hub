import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, PiggyBank, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSuperPayroll } from "@/lib/xero/reports.functions";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";

/**
 * Superannuation accrued per payday, from Xero payroll.
 *
 * Xero exposes NO record of super being paid to a fund — there is no endpoint
 * for super payment batches, auto-super submissions or their dates. So this
 * card reports what each payday accrued and how old the oldest one is. It
 * never says a payday was paid on time, and never says one was not: where a
 * payday is older than seven business days it says the super "may be overdue —
 * check the fund", which is the strongest claim the data supports.
 */

/** Business days between two dates, weekends only. Public holidays are not
 *  known to this app, so the count can be a day or two generous — the card
 *  says so rather than pretending to precision. */
function businessDaysSince(iso: string): number {
  const start = new Date(`${iso}T00:00:00`);
  const today = new Date();
  let days = 0;
  const cursor = new Date(start);
  while (cursor < today) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days += 1;
  }
  return days;
}

export function SuperannuationWidget({
  tenantId,
  tenantName,
  clientId,
}: {
  tenantId: string;
  tenantName: string;
  clientId?: string;
}) {
  const fetchSuper = useServerFn(getSuperPayroll);
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-super-payroll", tenantId, clientId ?? null],
    queryFn: () => fetchSuper({ data: { tenantId, clientId } }),
    retry: false,
  });

  const available = data?.status === "available" ? data : null;
  const latest = available?.latestPayday ?? null;
  const ageDays = latest ? businessDaysSince(latest) : null;
  const mayBeOverdue = ageDays !== null && ageDays > 7;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-primary" />
            Superannuation accrued on each payday
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {available
              ? `Pay runs from the last ${available.months} months`
              : "From this organisation's pay runs"}
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
      ) : data?.status === "no_payroll" ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              No payroll in this organisation
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              No pay runs have been posted, so no superannuation has been accrued.
            </p>
          </div>
        </div>
      ) : data?.status === "not_authorised" ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Payroll access has not been authorised</p>
            <p className="text-xs">
              This organisation needs to be reconnected in Xero before its pay runs can be read.
              Reconnecting grants read-only access only.
            </p>
          </div>
        </div>
      ) : !available || available.payRuns.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No pay runs were posted in this period, so no superannuation was accrued.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">
                Accrued across {available.payRuns.length}{" "}
                {available.payRuns.length === 1 ? "payday" : "paydays"}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                {fmt(available.accrued)}
              </p>
              {latest && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Most recent payday {format(new Date(`${latest}T00:00:00`), "d MMM yyyy")}
                  {ageDays !== null ? ` · about ${ageDays} business days ago` : ""}
                </p>
              )}
            </div>
            {mayBeOverdue && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">May be overdue — check the fund</p>
                  <p className="opacity-90">
                    The most recent payday is more than seven business days old.
                  </p>
                </div>
              </div>
            )}
          </div>

          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {available.payRuns.map((r, i) => (
              <li key={`${r.paymentDate}-${i}`} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0 truncate text-sm">
                  {r.paymentDate ? format(new Date(`${r.paymentDate}T00:00:00`), "d MMM yyyy") : "—"}
                  {r.periodEnd && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      period to {format(new Date(`${r.periodEnd}T00:00:00`), "d MMM")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums">{fmt(r.super)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Since 1 July 2026, super must reach each employee&apos;s fund within seven business days of
        the payday it relates to. The business-day count here ignores public holidays, so treat it
        as approximate.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Xero does not publish any record of super being paid to a fund, so this card cannot tell
        you whether a payday has been paid — only what was accrued, and when.
      </p>
    </div>
  );
}
