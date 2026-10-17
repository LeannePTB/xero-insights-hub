import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { DashboardCardHeader } from "./DashboardCardHeader";
import { paygQueryKey, paygQueryLimits } from "./payg-query";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Calculator, Loader2 } from "lucide-react";
import { getGstReconciliation } from "@/lib/xero/gst.functions";
import { getPaygWithholdingPosition } from "@/lib/xero/reports.functions";
import { listIncomeTaxInstalments } from "@/lib/income-tax-instalments.functions";
import { completedGstPeriod, type GstCycle } from "./recon-periods";
import { latestCompletedPaygMonth, netGstAmount, currentGstPeriod, forwardTax, pickCurrentInstalment, organisationToday } from "./tax-obligations";
import { getLodgedTaxBills } from "@/lib/xero/lodged-tax.functions";
import { getStoredTaxPosition } from "@/lib/tax/tax-position.functions";
import { formatMoneyExact, useTenantCurrency } from "./useTenantCurrency";
import { TaxObligationsBody } from "./TaxObligationsBody";

function periodLabel(from: string, to: string) {
  if (from.slice(0, 7) === to.slice(0, 7)) return format(new Date(`${from}T00:00:00`), "MMM yyyy");
  const start = format(new Date(`${from}T00:00:00`), "d MMM");
  const end = format(new Date(`${to}T00:00:00`), "d MMM yyyy");
  return `${start} – ${end}`;
}

export function TaxObligationsWidget({
  clientId,
  tenantId,
  tenantName,
  gstCycle,
  paygRegistered,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
  gstCycle: GstCycle | null;
  paygRegistered: boolean;
}) {
  const fetchGst = useServerFn(getGstReconciliation);
  const fetchPayg = useServerFn(getPaygWithholdingPosition);
  const fetchBills = useServerFn(getLodgedTaxBills);
  const listInstalments = useServerFn(listIncomeTaxInstalments);
  const currency = useTenantCurrency(tenantId);
  const money = (value: number) => formatMoneyExact(value, currency);
  const gstPeriod = useMemo(() => completedGstPeriod(gstCycle), [gstCycle]);

  const gstQuery = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, gstPeriod.kind, gstPeriod.asAt],
    queryFn: () => staggered(() => fetchGst({ data: { clientId, tenantId, asAt: gstPeriod.asAt, window: gstPeriod.kind } })),
    ...xeroQueryRetry,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: gstCycle !== "not_registered",
  });
  const todayIso = organisationToday();
  const runPeriod = useMemo(() => currentGstPeriod(gstCycle, todayIso), [gstCycle, todayIso]);
  const runGstQuery = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, runPeriod.kind, runPeriod.asAt],
    queryFn: () => staggered(() => fetchGst({ data: { clientId, tenantId, asAt: runPeriod.asAt, window: runPeriod.kind } })),
    ...xeroQueryRetry,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: gstCycle !== "not_registered" && gstCycle !== null,
  });
  const paygQuery = useQuery({
    queryKey: paygQueryKey(tenantId, clientId),
    queryFn: () => staggered(() => fetchPayg({ data: { tenantId, clientId, months: 9 } })),
    ...paygQueryLimits,
    ...xeroQueryRetry,
    enabled: paygRegistered,
  });
  const instalmentsQuery = useQuery({
    queryKey: ["income-tax-instalments", clientId, tenantId],
    queryFn: () => listInstalments({ data: { clientId, tenantId } }),
  });
  const fetchPosition = useServerFn(getStoredTaxPosition);
  const positionQuery = useQuery({
    queryKey: ["tax-position", clientId, tenantId],
    queryFn: () => fetchPosition({ data: { tenantId, widget: "tax_obligations" } }),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const billsQuery = useQuery({
    queryKey: ["lodged-tax-bills", tenantId, "tax_obligations"],
    queryFn: () => fetchBills({ data: { tenantId, widget: "tax_obligations" } }),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const gst = gstQuery.data;
  const payg = latestCompletedPaygMonth(paygQuery.data);
  const run = runGstQuery.data;
  const runPayg = paygQuery.data?.status === "available"
    // Same rule as the stored summary: PAYG withheld on paydays in the running period.
    ? Math.round(paygQuery.data.months.filter((m) => m.month >= runPeriod.from && m.month <= runPeriod.asAt).reduce((t, m) => t + m.withheld, 0) * 100) / 100
    : null;
  const frequency = instalmentsQuery.data?.frequency ?? null;
  const latestInstalment = pickCurrentInstalment(instalmentsQuery.data?.instalments ?? [], frequency, todayIso);
  const fwd = forwardTax({
    bills: billsQuery.data?.bills ?? [], today: todayIso, period: runPeriod,
    gst: gstCycle === "not_registered" ? 0 : run ? (run.statementNet ?? netGstAmount(run)) : null, payg: runPayg, paygRegistered,
    instalment: latestInstalment ? { amount: latestInstalment.amount, due: latestInstalment.due } : null,
    instalmentSetting: frequency ?? "unset",
  });
  const accountGap = run && run.closingBalance !== null && run.statementNet !== null ? Math.round((run.closingBalance - run.statementNet) * 100) / 100 : null;
  // One shared tax position (same as Business Health, Overview and reports); live figures only as a fallback.
  const shown = positionQuery.data?.tax ?? fwd;
  const busy = positionQuery.isLoading || gstQuery.isLoading || paygQuery.isLoading || instalmentsQuery.isLoading || runGstQuery.isLoading;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Tax obligations" icon={<Calculator className="h-4 w-4"/>} description="What still has to be paid to the ATO" source={paygQuery.data?.source} isFetching={gstQuery.isFetching || paygQuery.isFetching || runGstQuery.isFetching}/>
      {billsQuery.isError && <p className="mt-2 text-xs text-muted-foreground">Lodged bill status unavailable</p>}
      {busy ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <TaxObligationsBody
          forward={shown}
          money={money}
          paygRegistered={paygRegistered}
          buildingLabel={runPeriod.kind === "quarter"
            ? `${format(new Date(`${shown.building.from}T00:00:00`), "MMM")}–${format(new Date(`${shown.building.to}T00:00:00`), "MMM yyyy")}`
            : format(new Date(`${shown.building.from}T00:00:00`), "MMMM")}
          partPaid={(billsQuery.data?.bills ?? []).map((bill) => bill.total !== undefined && bill.total > bill.amount + 0.005)}
          today={todayIso}
          instalmentDisplay={frequency === "not_required" ? "not_required" : "required"}
          settingsLink={instalmentsQuery.data?.canEdit ? <Link to="/clients/$clientId/settings/tax-reporting" params={{ clientId }} hash="income-tax-instalments" className="text-link underline-offset-2 hover:underline">Set in Client settings</Link> : undefined}
          details={<>
          {run?.unfiled?.status === "estimate" && run.unfiled.sales - run.unfiled.purchases !== 0 && (
            <p className="text-xs text-muted-foreground">GST includes an estimated {money(run.unfiled.sales - run.unfiled.purchases)} of unfiled amounts from earlier periods.</p>
          )}
          {accountGap !== null && Math.abs(accountGap) >= 1 && (
            <p className="text-xs text-muted-foreground">GST account holds {money(Math.abs(accountGap))} {accountGap > 0 ? "more" : "less"} than this period's GST — worth checking in Xero.</p>
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Last lodged period: {gst ? `${periodLabel(gst.periodFrom, gst.periodTo)} · GST ${money(netGstAmount(gst))}` : "GST unavailable"}
            {payg ? ` · PAYG ${money(payg.amount)} (${format(new Date(`${payg.month}T00:00:00`), "MMM yyyy")})` : ""}
          </p>
          </>}
        />
      )}

    </div>
  );
}
