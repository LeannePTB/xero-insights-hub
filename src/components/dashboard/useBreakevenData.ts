import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { listCostClassifications } from "@/lib/cost-classification.functions";
import { getExpenseAccounts } from "@/lib/xero/accounts.functions";
import { buildClassificationResolver } from "@/lib/cost-classification";
import { breakevenFigures } from "@/components/dashboard/breakeven-figures";
import { classifyBreakevenLines } from "@/components/dashboard/breakeven-lines";
import { breakevenReadiness } from "@/components/dashboard/breakeven-readiness";
import {
  clearLegacyRangeStorage,
  toISO,
  startOfCurrentMonth,
  today,
} from "@/components/dashboard/DateRangeControls";


/**
 * Length of an inclusive date range in months, where each calendar month
 * contributes the fraction of its own length that the range covers. A whole
 * calendar month is exactly 1.0, so ranges made of whole months are unchanged;
 * a part month (1 Sep to 7 Sep) comes out below 1, which is what stops a few
 * days of trading being read as a full month.
 */
function monthsBetween(from: Date, to: Date) {
  if (to < from) return 0.1;
  let total = 0;
  let y = from.getFullYear();
  let m = from.getMonth();
  while (y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth())) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthStart = new Date(y, m, 1).getTime();
    const monthEnd = new Date(y, m, daysInMonth).getTime();
    const coverFrom = Math.max(monthStart, new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime());
    const coverTo = Math.min(monthEnd, new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime());
    total += (Math.round((coverTo - coverFrom) / 86_400_000) + 1) / daysInMonth;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return Math.max(0.1, total);
}


export function useBreakevenData({
  tenantId,
  clientId,
  basis,
  loadDelayMs = 0,
}: {
  tenantId: string;
  clientId?: string;
  basis: "accrual" | "cash";
  loadDelayMs?: number;
}) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const fetchClassifications = useServerFn(listCostClassifications);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  // Range is deliberately not persisted: every page load opens on the
  // default (1st of the current month → today).
  const [fromDate, setFromDate] = useState<Date>(startOfCurrentMonth);
  const [toDate, setToDate] = useState<Date>(today);
  useEffect(clearLegacyRangeStorage, []);

  const fromStr = toISO(fromDate);
  const toStr = toISO(toDate);

  const pnlQ = useQuery({
    queryKey: ["xero-pnl", tenantId, fromStr, toStr, basis],
    queryFn: () => fetchPnl({ data: { tenantId, fromDate: fromStr, toDate: toStr, widget: "accounting_breakeven", basis } }),
    enabled: shouldLoad,
    retry: false,
  });

  const classQ = useQuery({
    queryKey: ["cost-classifications", clientId, tenantId],
    queryFn: () => fetchClassifications({ data: { clientId: clientId!, tenantId } }),
    enabled: shouldLoad && !!clientId,
  });

  const fetchAccounts = useServerFn(getExpenseAccounts);
  const accountsQ = useQuery({
    queryKey: ["xero-expense-accounts", clientId, tenantId],
    queryFn: () => fetchAccounts({ data: { clientId: clientId!, tenantId } }),
    enabled: shouldLoad && !!clientId,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const classificationEnabled = classQ.data?.enabled ?? true;
  const resolver = useMemo(
    () =>
      buildClassificationResolver({
        stored: classQ.data?.rows ?? [],
        accounts: accountsQ.data?.accounts ?? [],
        enabled: classificationEnabled,
      }),
    [classQ.data, accountsQ.data, classificationEnabled],
  );

  const data = pnlQ.data;

  // Nothing is calculated from partial inputs: an in-flight classification list
  // reads as an empty list, which silently seeds cost-of-sales accounts as
  // variable. See breakeven-readiness.ts.
  const readiness = breakevenReadiness({
    needsClassifications: !!clientId,
    report: { data, error: pnlQ.error },
    classifications: { data: classQ.data, error: classQ.error },
    accounts: { data: accountsQ.data, error: accountsQ.error },
  });
  const classificationError = readiness.status === "classification-error";
  const canCalculate = readiness.canCalculate;

  const income = data?.totalIncome ?? 0;
  const cogs = data?.totalCostOfSales ?? 0;
  const opex = data?.totalExpenses ?? 0;
  const expenseLines = data?.expenseLines ?? [];
  const cogsLines = data?.cogsLines ?? [];

  // Both P&L sections go through the same resolver: a cost-of-sales line tagged
  // Fixed is fixed, and only an undecided cost-of-sales line falls back to
  // variable. See breakeven-lines.ts.
  const split = classifyBreakevenLines({
    expenseLines,
    cogsLines,
    totalExpenses: opex,
    totalCostOfSales: cogs,
    resolve: (name) => resolver.resolve(name),
    classificationEnabled,
  });
  const {
    fixedLines,
    variableLines,
    excludedCount,
    unclassifiedCount,
    unitemisedBalance,
    cogsUnitemisedBalance,
  } = split;
  const fixedOpex = split.fixedTotal;
  const excludedOpex = split.excludedTotal;
  const variableOpex = variableLines
    .filter((l) => l.section === "operating")
    .reduce((a, l) => a + l.amount, 0);
  const variableCogs = split.variableTotal - variableOpex;

  const months = monthsBetween(fromDate, toDate);
  const totalVariable = split.variableTotal;
  // Null until every input has resolved: a caller cannot render a figure from
  // partial inputs even by accident.
  const figures = canCalculate
    ? breakevenFigures({ income, totalVariable, fixedOpex, months })
    : null;
  const grossMargin = figures?.grossMargin ?? 0;
  const monthlyIncome = figures?.monthlyIncome ?? 0;
  const breakevenRevenue = figures?.monthlyBreakeven ?? 0;

  return {
    shouldLoad,
    setShouldLoad,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    fromStr,
    toStr,
    // Loading covers the classification and account requests too, not just the
    // report.
    isLoading: readiness.status === "loading",
    isFetching: pnlQ.isFetching || classQ.isFetching || accountsQ.isFetching,
    error: pnlQ.error,
    classificationError,
    canCalculate,
    refetchClassifications: () => {
      void classQ.refetch();
      void accountsQ.refetch();
    },
    refetch: pnlQ.refetch,
    // Deliberately NOT exposed: React Query's `dataUpdatedAt`. Freshness comes
    // from the provenance the server returns on `data.source`, never from when
    // our own query happened to run.
    data,
    income,
    cogs,
    opex,
    variableOpex,
    variableCogs,
    cogsUnitemisedBalance,
    fixedOpex,
    excludedOpex,
    excludedCount,
    unclassifiedCount,
    unitemisedBalance,
    // A plug worth more than a twentieth of fixed costs moves break-even by the
    // same proportion, which is well past rounding and means the report is not
    // being read correctly.
    unitemisedMaterial:
      fixedOpex !== 0 && Math.abs(unitemisedBalance) / Math.abs(fixedOpex) > 0.05,
    fixedLines,
    variableLines,
    classificationEnabled,
    orphanTags: resolver.orphans,
    months,
    totalVariable,
    grossMargin,
    // Monthly-basis figures: every money row on the card uses these.
    figures,
    breakevenRevenue,
    monthlyIncome,
  };
}

export function fmtAUD(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}
export function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
