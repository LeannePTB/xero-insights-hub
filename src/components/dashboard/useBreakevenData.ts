import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { listCostClassifications } from "@/lib/cost-classification.functions";
import { getExpenseAccounts } from "@/lib/xero/accounts.functions";
import { buildClassificationResolver } from "@/lib/cost-classification";
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
  const income = data?.totalIncome ?? 0;
  const cogs = data?.totalCostOfSales ?? 0;
  const opex = data?.totalExpenses ?? 0;
  const expenseLines = data?.expenseLines ?? [];

  let variableOpex = 0;
  let fixedOpex = 0;
  let excludedOpex = 0;
  let excludedCount = 0;
  let unclassifiedCount = 0;
  const fixedLines: { name: string; amount: number; unclassified: boolean }[] = [];
  const variableLines: { name: string; amount: number }[] = [];
  if (!classificationEnabled || expenseLines.length === 0) {
    fixedOpex = opex;
    for (const line of expenseLines) {
      fixedLines.push({ name: line.name, amount: line.amount, unclassified: true });
    }
  } else {
    for (const line of expenseLines) {
      // One shared resolution: a stored tag wins, then Xero's account type
      // seeds a default, and anything still undecided is fixed.
      const r = resolver.resolve(line.name);
      if (r.effective === "variable") {
        variableOpex += line.amount;
        variableLines.push({ name: line.name, amount: line.amount });
      } else if (r.effective === "excluded") {
        excludedOpex += line.amount;
        excludedCount += 1;
      } else {
        fixedOpex += line.amount;
        fixedLines.push({ name: line.name, amount: line.amount, unclassified: r.unclassified });
        if (r.unclassified) unclassifiedCount += 1;
      }
    }
    const linesTotal = variableOpex + fixedOpex + excludedOpex;
    if (Math.abs(linesTotal - opex) > 0.5) fixedOpex += opex - linesTotal;
  }
  fixedLines.sort((a, b) => b.amount - a.amount);
  variableLines.sort((a, b) => b.amount - a.amount);

  const months = monthsBetween(fromDate, toDate);
  const totalVariable = cogs + variableOpex;
  const grossMargin = income > 0 ? (income - totalVariable) / income : 0;
  const breakevenRevenue = grossMargin > 0 ? fixedOpex / grossMargin : 0;
  const monthlyIncome = income / months;

  return {
    shouldLoad,
    setShouldLoad,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    fromStr,
    toStr,
    isLoading: pnlQ.isLoading,
    isFetching: pnlQ.isFetching,
    error: pnlQ.error,
    refetch: pnlQ.refetch,
    updatedAt: pnlQ.dataUpdatedAt,
    data,
    income,
    cogs,
    opex,
    variableOpex,
    fixedOpex,
    excludedOpex,
    excludedCount,
    unclassifiedCount,
    fixedLines,
    variableLines,
    classificationEnabled,
    orphanTags: resolver.orphans,
    months,
    totalVariable,
    grossMargin,
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
