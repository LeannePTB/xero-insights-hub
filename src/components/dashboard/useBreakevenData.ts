import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { listCostClassifications } from "@/lib/cost-classification.functions";
import { usePersistedDate, toISO } from "@/components/dashboard/DateRangeControls";

function startOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function monthsBetween(from: Date, to: Date) {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    (to.getDate() >= from.getDate() ? 1 : 0);
  const ms = to.getTime() - from.getTime();
  const fractional = ms / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0.1, Math.max(months, fractional));
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
  const storageKey = `breakeven-range:${tenantId}`;
  const [fromDate, setFromDate] = usePersistedDate(`${storageKey}:from`, startOfThisMonth);
  const [toDate, setToDate] = usePersistedDate(`${storageKey}:to`, endOfThisMonth);

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

  const classificationEnabled = classQ.data?.enabled ?? true;
  const classMap = useMemo(() => {
    const m = new Map<string, "fixed" | "variable" | "excluded">();
    for (const r of classQ.data?.rows ?? []) m.set(r.account_name, r.classification);
    return m;
  }, [classQ.data]);

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
      const c = classMap.get(line.name);
      if (c === "variable") {
        variableOpex += line.amount;
        variableLines.push({ name: line.name, amount: line.amount });
      } else if (c === "excluded") {
        excludedOpex += line.amount;
        excludedCount += 1;
      } else {
        fixedOpex += line.amount;
        fixedLines.push({ name: line.name, amount: line.amount, unclassified: !c });
        if (!c) unclassifiedCount += 1;
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
