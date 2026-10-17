import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss, getPaydayCounts } from "@/lib/xero/reports.functions";
import { sameDaysPreviousMonth, paydayNote, shortRange } from "@/lib/pnl-comparison";
import { PnlKpi as Kpi } from "./PnlKpi";
import { Loader2, RefreshCw, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { splitWages, wageAccountNames } from "@/lib/wages-split";
import { useCanManageClient } from "@/hooks/useCanManageClient";
import { StandardHistoryChart } from '@/components/charts/StandardHistoryChart';

import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import {
  PeriodSelect,
  monthRangeFor,
  clearLegacyRangeStorage,
  toISO,
} from "@/components/dashboard/DateRangeControls";
import { CardFreshness } from "@/components/dashboard/CardFreshness";
import { useTenantCurrency } from "@/components/dashboard/useTenantCurrency";



function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PnlWidget({
  tenantId,
  tenantName,
  loadDelayMs = 0,
  basis = "accrual",
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
  basis?: "accrual" | "cash";
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const currency = useTenantCurrency(tenantId);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  // Preset-only period: no free date pickers on this card. Not persisted —
  // every page load opens on the current month to date.
  const [period, setPeriod] = useState<string>("current");
  const { from: fromDate, to: toDate } = monthRangeFor(period);
  useEffect(clearLegacyRangeStorage, []);

  const fromStr = toISO(fromDate);
  const toStr = toISO(toDate);
  const prior = sameDaysPreviousMonth(fromDate, toDate);
  const priorFromStr = toISO(prior.from);
  const priorToStr = toISO(prior.to);
  const priorLabel = shortRange(prior.from, prior.to);
  const currentLabel = shortRange(fromDate, toDate);
  const fetchPaydays = useServerFn(getPaydayCounts);
  const paydaysQ = useQuery({
    queryKey: ["pnl-paydays", tenantId, fromStr, toStr, priorFromStr, priorToStr],
    queryFn: () => fetchPaydays({ data: { tenantId, current: [fromStr, toStr], prior: [priorFromStr, priorToStr] } }),
    enabled: shouldLoad,
    staleTime: 30 * 60 * 1000,
  });
  const note = paydayNote(paydaysQ.data?.current ?? null, paydaysQ.data?.prior ?? null);

  const forceLive = useRef(false);
  const { data, isLoading, isFetching, error, refetch: runQuery } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromStr, toStr, priorFromStr, priorToStr, basis],
    queryFn: async () => {
      const refresh = forceLive.current;
      forceLive.current = false;
      const current = await staggered(() => fetchPnl({ data: { tenantId, fromDate: fromStr, toDate: toStr, widget: "pnl", basis, refresh } }));
      // Space live calls out; saved figures need no pause.
      if (current.source?.mode !== "snapshot") await wait(1_500);
      const priorReport = await staggered(() => fetchPnl({ data: { tenantId, fromDate: priorFromStr, toDate: priorToStr, widget: "pnl", basis, refresh } }));
      return { current, prior: priorReport };
    },
    enabled: shouldLoad,
    staleTime: 30 * 60 * 1000,
    ...xeroQueryRetry,
  });

  const current = data?.current;
  const priorData = data?.prior;
  const names = wageAccountNames((current?.wageAccounts ?? []).map((account_name) => ({ account_name, is_wages: true })));
  const clientId = current?.clientId ?? null;
  const { canManage } = useCanManageClient(clientId);
  const split = (r: typeof current) => r ? splitWages({ costOfSales: r.totalCostOfSales, expenses: r.totalExpenses, cogsLines: r.cogsLines, expenseLines: r.expenseLines }, names) : null;
  const cur = split(current);
  const pri = split(priorData);

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Profit & loss" icon={<LineChart className="h-4 w-4"/>} description="Income, expenses and net profit for the selected period" badge={<BasisBadge basis={basis ?? "accrual"}/>} from={fromDate} to={toDate} source={data?.current.source} isFetching={isFetching} stackActions actions={<><PeriodSelect value={period} onChange={setPeriod} monthsBack={6} className="" /><Button variant="ghost" size="icon-sm" onClick={() => { setShouldLoad(true); forceLive.current = true; runQuery(); }} disabled={isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}/></Button></>}/>

      <StandardHistoryChart tenantId={tenantId} card="pnl" currency={currency} basis={basis}/>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load P&L"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading P&L…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => runQuery()} isRetrying={isFetching} />
      ) : current ? (
        <>
          <h3 className="mt-4 text-sm font-normal text-foreground">How {currentLabel} compares with {priorLabel}</h3>
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Income" value={current.totalIncome} previous={priorData?.totalIncome ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
            {cur?.split ? <>
              <Kpi label="Cost of sales (excl. wages)" value={cur.costOfSalesExWages} previous={pri?.costOfSalesExWages ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
              <Kpi label="Wages" value={cur.wages} previous={pri?.wages ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
              <Kpi label="Gross Profit" value={current.grossProfit} previous={priorData?.grossProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
              <Kpi label="Overheads (excl. wages)" value={cur.overheadsExWages} previous={pri?.overheadsExWages ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
            </> : <>
              <Kpi label="Cost of Sales" value={current.totalCostOfSales} previous={priorData?.totalCostOfSales ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
              <Kpi label="Gross Profit" value={current.grossProfit} previous={priorData?.grossProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
              <Kpi label="Expenses" value={current.totalExpenses} previous={priorData?.totalExpenses ?? 0} higherIsBetter={false} currency={currency} priorLabel={priorLabel} />
            </>}
            <Kpi label="Net Profit" value={current.netProfit} previous={priorData?.netProfit ?? 0} higherIsBetter currency={currency} priorLabel={priorLabel} />
          </div>
          {cur?.split && clientId ? <p className="mt-2 text-xs text-muted-foreground">Wages = accounts marked Wages in <Link to="/clients/$clientId/settings/account-setup" params={{ clientId }} className="text-link hover:underline">Cost classification</Link> ({names.size} account{names.size === 1 ? "" : "s"})</p>
            : !cur?.split && canManage && clientId ? <p className="mt-2 text-xs text-muted-foreground"><Link to="/clients/$clientId/settings/account-setup" params={{ clientId }} className="text-link hover:underline">Mark wage accounts in Cost classification</Link> to see wages separately.</p> : null}
        </>
      ) : null}
    </div>
  );
}

