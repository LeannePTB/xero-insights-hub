import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, PiggyBank, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSuperannuationPosition } from "@/lib/xero/reports.functions";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";
import { CardFreshness } from "@/components/dashboard/CardFreshness";

/**
 * Superannuation not yet paid.
 *
 * The figure is the balance on the superannuation liability account: accrued
 * less paid. Xero exposes no super payment data through its API, so payment is
 * inferred from that balance falling — this card never claims to see a payment
 * or its status. Pay run data is used only to explain an outstanding balance.
 */

/** Business days between a date and today, weekends only. Public holidays are
 *  not known to this app, so the count can be a day or two generous. */
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
  const fetchSuper = useServerFn(getSuperannuationPosition);
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-super-position", tenantId, clientId ?? null],
    queryFn: () => fetchSuper({ data: { tenantId, clientId } }),
    retry: false,
  });

  const available = data?.status === "available" ? data : null;
  const outstanding = available?.outstanding ?? 0;
  const isPaidUp = !!available && outstanding <= 0.005;
  const oldest = available?.oldestUnpaidPayday ?? null;
  const ageDays = oldest ? businessDaysSince(oldest) : null;
  const mayBeOverdue = !isPaidUp && ageDays !== null && ageDays > 7;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-primary" />
            Superannuation not yet paid
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The balance on this organisation&apos;s superannuation account
          </p>
          {/* The balance is live, the pay runs may be last night's copy: the
              line reports the older of the two. */}
          <CardFreshness className="mt-1.5" source={data?.source} isFetching={isFetching} />
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
      ) : data?.status === "no_super_accounts" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          This organisation has no superannuation account on its balance sheet, so there is nothing
          to report here.
        </p>
      ) : isPaidUp ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              All super paid — nothing outstanding
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              The superannuation account balance is nil, so no accrued super is waiting to go to
              employees&apos; funds.
            </p>
          </div>
        </div>
      ) : available ? (
        <>
          <div className="mt-6">
            <p className="text-xs text-muted-foreground">Super not yet paid</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{fmt(outstanding)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {available.matchesPaydays && available.unpaidPaydays && oldest
                ? `This is the super accrued on the last ${available.unpaidPaydays} ${
                    available.unpaidPaydays === 1 ? "payday" : "paydays"
                  }, the oldest being ${format(new Date(`${oldest}T00:00:00`), "d MMM yyyy")}.`
                : oldest
                  ? `The oldest payday not yet covered is ${format(
                      new Date(`${oldest}T00:00:00`),
                      "d MMM yyyy",
                    )}. The balance does not match whole paydays, so it is shown as an amount only.`
                  : available.payrollStatus === "not_authorised"
                    ? "Payroll access has not been authorised in Xero for this organisation, so the paydays behind this balance cannot be identified."
                    : "The paydays behind this balance could not be identified from this organisation's pay runs."}
            </p>
          </div>

          {available.accounts.length > 1 && (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {available.accounts.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm">{a.name}</span>
                  <span className="shrink-0 text-sm tabular-nums">{fmt(a.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          {mayBeOverdue && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">May be overdue — check the fund</p>
                <p className="opacity-90">
                  Since 1 July 2026 super must reach each employee&apos;s fund within seven business
                  days of the payday it relates to, and the oldest payday here is older than that.
                  The business-day count ignores public holidays, so treat it as approximate.
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Xero does not make super payments available through its connection, so this card works from
        the account balance falling as super is paid, not from any record of a payment.
      </p>
    </div>
  );
}
