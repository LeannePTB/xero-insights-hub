import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaygWithholdingPosition } from "@/lib/xero/reports.functions";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";
import { CardFreshness } from "@/components/dashboard/CardFreshness";

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
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-payg-withholding", tenantId, clientId ?? null],
    queryFn: () => fetchPayg({ data: { tenantId, clientId, months: 6 } }),
    retry: false,
  });

  const available = data?.status === "available" ? data : null;
  const outstanding =
    data?.status === "available" || data?.status === "no_payroll" ? data.outstanding : 0;
  const isPaidUp = !!data && data.status !== "no_payg_accounts" && outstanding <= 0.005;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            PAYG withholding by month
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            What was withheld from wages each month, and what is still owing
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
      ) : data?.status === "no_payg_accounts" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          This organisation has no PAYG withholding account on its balance sheet, so there is
          nothing to report here.
        </p>
      ) : data?.status === "no_payroll" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {data.reason === "no_payroll"
            ? "No wages have been paid through payroll in this organisation, so there is no PAYG withholding to report by month."
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
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                {fmt(outstanding)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {available.matchesMonths && available.oldestOwingMonth
                  ? `This is the PAYG withheld back to ${monthLabel(
                      available.oldestOwingMonth,
                    )}. Months before that are covered by payments already made.`
                  : available.oldestOwingMonth
                    ? `The balance reaches back to ${monthLabel(
                        available.oldestOwingMonth,
                      )}. It does not divide into whole months, so no month-by-month split is shown — only the amount owing.`
                    : "The months behind this balance could not be identified from this organisation's pay runs."}
              </p>
            </div>
          )}

          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {available.months.map((m) => (
              <li key={m.month} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="text-sm">{monthLabel(m.month)}</span>
                  {m.incomplete && (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      still running — this month is not finished
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {available.matchesMonths && !isPaidUp && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        m.owing
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {m.owing ? "Still owing" : "Paid"}
                    </span>
                  )}
                  <span className="text-sm tabular-nums">{fmt(m.withheld)}</span>
                </span>
              </li>
            ))}
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

      <p className="mt-4 text-xs text-muted-foreground">
        Monthly amounts come from the pay runs paid in each month. Xero does not make ATO
        lodgements or payments available through its connection, so what is owing is worked out
        from the PAYG withholding account balance falling as it is paid, not from any record of a
        payment.
      </p>
    </div>
  );
}
