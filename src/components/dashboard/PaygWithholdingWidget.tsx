import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { paygQueryKey, paygQueryLimits } from "./payg-query";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaygWithholdingPosition } from "@/lib/xero/reports.functions";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";
import { CardFreshness } from "@/components/dashboard/CardFreshness";
import { getLodgedTaxBills } from "@/lib/xero/lodged-tax.functions";
import { paygMonthState } from "./tax-obligations";

/**
 * PAYG withholding, month by month.
 *
 * The monthly figures are the `Tax` field on pay runs paid in that month. What
 * is still owing is the PAYG withholding liability account balance — accrued
 * less paid. Xero exposes no ATO lodgement or payment data, so payment is
 * inferred from that balance falling; this card never claims to see either.
 */

function monthLabel(iso: string) {
  return format(new Date(`${iso}T00:00:00`), "MMMM yyyy");
}

function dayLabel(iso: string) {
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

export function PaygWithholdingWidget({
  tenantId,
  tenantName,
  clientId,
}: {
  tenantId: string;
  tenantName: string;
  clientId?: string;
}) {
  const fetchPayg = useServerFn(getPaygWithholdingPosition);
  const fetchBills = useServerFn(getLodgedTaxBills);
  const billsQ = useQuery({
    queryKey: ["lodged-tax-bills", tenantId, "payg_withholding"],
    queryFn: () => fetchBills({ data: { tenantId, widget: "payg_withholding" } }),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: paygQueryKey(tenantId, clientId),
    queryFn: () => staggered(() => fetchPayg({ data: { tenantId, clientId, months: 6 } })),
    ...paygQueryLimits,
    ...xeroQueryRetry,
  });

  const available = data?.status === "available" ? data : null;
  const outstanding =
    data?.status === "available" || data?.status === "no_payroll" ? data.outstanding : 0;
  const hasLodgedOwing = available?.months.some(m => paygMonthState(m, billsQ.data?.bills ?? [], billsQ.data?.complete === true).startsWith("lodged")) === true;
  const isPaidUp = !!data && data.status !== "no_payg_accounts" && outstanding <= 0.005 && !hasLodgedOwing && billsQ.data?.complete === true;

  if (!isLoading && !error && data && (data.status === 'no_payg_accounts' || data.status === 'no_payroll')) {
    const explanation = data.status === 'no_payg_accounts' ? 'No PAYG withholding account exists on this Xero file’s balance sheet.'
      : data.reason === 'not_registered' ? 'This client is not registered for PAYG withholding.'
      : data.reason === 'setting_required' ? 'Set how often this client lodges PAYG withholding before payroll figures can be shown.'
      : data.reason === 'not_authorised' ? 'Xero has not authorised payroll access for this file.'
      : data.reason === 'no_payroll' ? 'No wages have been paid through payroll in this Xero file.'
      : 'Pay runs could not be read, so monthly withholding is unavailable.';
    return <CompactCardState label={tenantName} title="PAYG withholding by month" icon={<Receipt className="h-4 w-4"/>} summary={data.status === 'no_payg_accounts' ? 'No PAYG withholding account' : `Monthly figures unavailable${outstanding > 0.005 ? ` · ${fmt(outstanding)} still owing` : ''}`} explanation={explanation} source={data.source} isFetching={isFetching}/>;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="PAYG withholding by month" icon={<Receipt className="h-4 w-4"/>} description="Monthly wage withholding and what is still owing" source={data?.source} isFetching={isFetching} actions={<Button variant="ghost" size="icon-sm" onClick={() => refetch()} disabled={isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}/></Button>}/>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : error ? (
        <div className="mt-4">
          <XeroErrorNotice error={error} onRetry={() => refetch()} />
        </div>
      ) : data?.status === "no_payg_accounts" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          This organisation has no PAYG withholding account on its balance sheet, so there is
          nothing to report here.
        </p>
      ) : data?.status === "no_payroll" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {data.reason === "no_payroll"
            ? "No wages have been paid through payroll in this organisation, so there is no PAYG withholding to report by month."
            : data.reason === "not_registered"
              ? "This client is not registered for PAYG withholding."
              : data.reason === "setting_required"
                ? "Set how often this client lodges PAYG withholding before payroll figures can be shown."
            : data.reason === "not_authorised"
              ? "Payroll access has not been authorised in Xero for this organisation, so the monthly PAYG withheld cannot be read. Reconnecting it grants read-only access only."
              : "This organisation's pay runs could not be read just now, so the monthly PAYG withheld is not available."}
        </p>
      ) : available ? (
        <>
          {isPaidUp ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  All PAYG withholding paid — nothing owing
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  The PAYG withholding account balance is nil, so nothing withheld from wages is
                  still sitting with the business.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <p className="text-xs text-muted-foreground">PAYG withholding still owing</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                {fmt(outstanding)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {available.matchesMonths && available.oldestOwingMonth
                  ? `This is the PAYG withheld back to ${monthLabel(
                      available.oldestOwingMonth,
                    )}. Open lodged ATO bills are shown separately below.`
                  : available.oldestOwingMonth
                    ? `${fmt(
                        available.outstanding - available.residue,
                      )} of this is the PAYG withheld in the months ticked below, back to ${monthLabel(
                        available.oldestOwingMonth,
                      )}. Open lodged ATO bills are shown separately below.`
                    : "The months behind this balance could not be identified from this organisation's pay runs."}
              </p>

              {/* REQUIREMENT: a residue is never attributed to an older month.
                  It is stated for what it is. */}
              {available.residue > 0.005 && (
                <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  {available.residueKind === "since_last_pay_run" ? (
                    <>
                      <span className="font-medium tabular-nums">{fmt(available.residue)}</span>{" "}
                      withheld since the last saved pay run
                      {available.vintage.latestPayRunDate
                        ? ` on ${dayLabel(available.vintage.latestPayRunDate)}`
                        : ""}
                      . It is in the balance above but not yet in the monthly figures, so it is not
                      assigned to a month.
                    </>
                  ) : (
                    <>
                      <span className="font-medium tabular-nums">{fmt(available.residue)}</span> of
                      this balance is not accounted for by any whole month of pay runs — it is shown
                      as an amount only, and is not assigned to an earlier month.
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* REQUIREMENT: show both vintages whenever they differ, so a
              mismatch is visible rather than silently absorbed. */}
          {available.vintage.differs && (
            <div className="mt-4 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              <p>
                Balance read from Xero just now
                {available.vintage.balanceFetchedAt
                  ? ` (${format(new Date(available.vintage.balanceFetchedAt), "d MMM yyyy, h:mmaaa")})`
                  : ""}
                .
              </p>
              <p>
                Pay runs from the saved copy taken
                {available.vintage.payRunsAsAt
                  ? ` as at ${dayLabel(available.vintage.payRunsAsAt)}`
                  : ""}
                {available.vintage.latestPayRunDate
                  ? `, the newest being ${dayLabel(available.vintage.latestPayRunDate)}`
                  : ""}
                . Anything paid since then is in the balance but not in the months below.
              </p>
              {!available.vintage.payRunsComplete && (
                <p className="mt-1">
                  That saved copy was an incomplete pull: it holds the most recent pay runs and
                  stops at the read limit, so the oldest history is missing. Recent months are
                  unaffected.
                </p>
              )}
            </div>
          )}

          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {available.months.map((m) => {
              const state = paygMonthState(m, billsQ.data?.bills ?? [], billsQ.data?.complete === true);
              const label = state === "lodged_part_paid" ? "Lodged · part paid" : state === "lodged_owing" ? "Lodged · still owing" : state === "owing" ? "Still owing" : "Paid";
              return <li key={m.month} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="text-sm">{monthLabel(m.month)}</span>
                  {m.incomplete && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      still running — this month is not finished
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {state !== "unknown" && (!isPaidUp || state.startsWith("lodged")) && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        state !== "paid"
                          ? "bg-info/10 text-info"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {label}
                    </span>
                  )}
                  <span className="text-sm tabular-nums">{fmt(m.withheld)}</span>
                </span>
              </li>;
            })}
          </ul>

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
        </>
      ) : null}

      {available?.status === "available" && available.misfiledAccounts.length > 0 && (
        <p className="mt-4 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info border-info/30 bg-info/10 text-info">
          Worth tidying in Xero:{" "}
          {available.misfiledAccounts
            .map((a) => `${a.name}${a.code ? ` (${a.code})` : ""} is filed under ${a.type}`)
            .join("; ")}
          . PAYG withholding is a current liability. This does not change the figure above.
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Monthly amounts come from the pay runs paid in each month. Open lodged ATO activity-statement bills take precedence over payment inferred from the PAYG withholding account balance.
      </p>
    </div>
  );
}
