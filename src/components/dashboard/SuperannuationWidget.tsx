import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
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
    queryFn: () => staggered(() => fetchSuper({ data: { tenantId, clientId } })),
    ...xeroQueryRetry,
  });

  const available = data?.status === "available" ? data : null;
  const outstanding = available?.outstanding ?? 0;
  const isPaidUp = !!available && outstanding <= 0.005;
  const oldest = available?.oldestUnpaidPayday ?? null;
  const ageDays = oldest ? businessDaysSince(oldest) : null;
  const mayBeOverdue = !isPaidUp && ageDays !== null && ageDays > 7;

  if (!isLoading && !error && data && data.status !== 'available') {
    const explanation = data.status === 'no_super_accounts'
      ? 'This Xero file has no superannuation account on its balance sheet.'
      : data.status === 'payroll_not_registered'
        ? 'This client is not registered for PAYG withholding, so payroll figures are not requested.'
        : 'Set how often this client lodges PAYG withholding before payroll figures can be shown.';
    return <CompactCardState label={tenantName} title="Superannuation not yet paid" icon={<PiggyBank className="h-4 w-4"/>} summary={data.status === 'no_super_accounts' ? 'No superannuation account' : 'Payroll figures unavailable'} explanation={explanation} source={data.source} isFetching={isFetching}/>;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Superannuation not yet paid" icon={<PiggyBank className="h-4 w-4"/>} description="The balance on this Xero file’s superannuation account" source={data?.source} isFetching={isFetching} actions={<Button variant="ghost" size="icon-sm" onClick={() => refetch()} disabled={isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}/></Button>}/>

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
      ) : data?.status === "payroll_not_registered" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          This client is not registered for PAYG withholding, so payroll figures are not requested.
        </p>
      ) : data?.status === "payroll_setting_required" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Set how often this client lodges PAYG withholding before payroll figures can be shown.
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
            <p className="mt-1 font-display text-lg font-semibold tabular-nums">{fmt(outstanding)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {available.matchesPaydays && available.unpaidPaydays && oldest
                ? `This is the super accrued on the last ${available.unpaidPaydays} ${
                    available.unpaidPaydays === 1 ? "payday" : "paydays"
                  }, the oldest being ${format(new Date(`${oldest}T00:00:00`), "d MMM yyyy")}.`
                : oldest
                  ? `The paydays this balance fully covers go back to ${format(
                      new Date(`${oldest}T00:00:00`),
                      "d MMM yyyy",
                    )}. The rest does not match whole paydays and is not assigned to an earlier payday.`
                  : available.payrollStatus === "not_authorised"
                    ? "Payroll access has not been authorised in Xero for this organisation, so the paydays behind this balance cannot be identified."
                    : "The paydays behind this balance could not be identified from this organisation's pay runs."}
            </p>
            {/* A residue is stated for what it is, never attributed to an
                older payday. */}
            {available.residue > 0.005 && (
              <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                {available.residueKind === "since_last_pay_run" ? (
                  <>
                    <span className="font-medium tabular-nums">{fmt(available.residue)}</span>{" "}
                    accrued since the last saved pay run
                    {available.vintage.latestPayRunDate
                      ? ` on ${format(new Date(`${available.vintage.latestPayRunDate}T00:00:00`), "d MMM yyyy")}`
                      : ""}
                    . It is in the balance above but not yet in the paydays counted.
                  </>
                ) : (
                  <>
                    <span className="font-medium tabular-nums">{fmt(available.residue)}</span> of
                    this balance is not accounted for by whole paydays, and is not assigned to an
                    earlier payday.
                  </>
                )}
              </p>
            )}

            {/* Both vintages, shown whenever they differ. */}
            {available.vintage.differs && (
              <div className="mt-3 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                <p>Balance read from Xero just now.</p>
                <p>
                  Pay runs from the saved copy
                  {available.vintage.payRunsAsAt
                    ? ` as at ${format(new Date(`${available.vintage.payRunsAsAt}T00:00:00`), "d MMM yyyy")}`
                    : ""}
                  . Anything accrued since then is in the balance but not in the paydays counted.
                </p>
                {!available.vintage.payRunsComplete && (
                  <p className="mt-1">
                    That saved copy was an incomplete pull: it holds the most recent pay runs and
                    stops at the read limit, so the oldest history is missing.
                  </p>
                )}
              </div>
            )}
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
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info border-info/30 bg-info/10 text-info">
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
