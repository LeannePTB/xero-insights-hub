import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import { listCostClassifications } from "@/lib/cost-classification.functions";
import {
  Loader2,
  Target,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CalendarIcon,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
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

function usePersistedDate(key: string, fallback: () => Date): [Date, (d: Date) => void] {
  const [date, setDate] = useState<Date>(() => {
    if (typeof window === "undefined") return fallback();
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
      }
    } catch {}
    return fallback();
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, toISO(date));
    } catch {}
  }, [key, date]);
  return [date, setDate];
}


export function BreakevenWidget({
  tenantId,
  tenantName,
  clientId,
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  clientId?: string;
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

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromStr, toStr, "accrual"],
    queryFn: () => fetchPnl({ data: { tenantId, fromDate: fromStr, toDate: toStr, widget: "breakeven", basis: "accrual" } }),
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

  const income = data?.totalIncome ?? 0;
  const cogs = data?.totalCostOfSales ?? 0;
  const opex = data?.totalExpenses ?? 0;
  const expenseLines = data?.expenseLines ?? [];

  // Split opex into fixed vs variable using the classification map. Unclassified defaults to fixed.
  // Excluded accounts are left out of the breakeven entirely.
  // When classification is disabled for this client, treat all opex as fixed.
  let variableOpex = 0;
  let fixedOpex = 0;
  let excludedOpex = 0;
  let excludedCount = 0;
  let unclassifiedCount = 0;
  const fixedLines: { name: string; amount: number; unclassified: boolean }[] = [];
  const variableLines: { name: string; amount: number }[] = [];
  if (!classificationEnabled || expenseLines.length === 0) {
    fixedOpex = opex;
    variableOpex = 0;
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
    // Reconcile rounding: if line items don't sum exactly to opex, attribute the diff to fixed
    const linesTotal = variableOpex + fixedOpex + excludedOpex;
    if (Math.abs(linesTotal - opex) > 0.5) {
      fixedOpex += opex - linesTotal;
    }
  }
  fixedLines.sort((a, b) => b.amount - a.amount);
  variableLines.sort((a, b) => b.amount - a.amount);


  const months = monthsBetween(fromDate, toDate);
  const totalVariable = cogs + variableOpex;
  const grossMargin = income > 0 ? (income - totalVariable) / income : 0;
  const breakevenRevenue = grossMargin > 0 ? fixedOpex / grossMargin : 0;
  const monthlyBreakeven = breakevenRevenue / months;
  const monthlyFixed = fixedOpex / months;
  const monthlyVariable = totalVariable / months;
  const monthlyIncome = income / months;
  const surplus = monthlyIncome - monthlyBreakeven;
  const coverage = monthlyBreakeven > 0 ? monthlyIncome / monthlyBreakeven : 0;
  const progress = monthlyBreakeven > 0 ? Math.min(100, (monthlyIncome / monthlyBreakeven) * 100) : 0;
  const aboveBreakeven = surplus >= 0;

  function setPreset(months: number) {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
    setFromDate(start);
    setToDate(end);
  }
  function setLastMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    setFromDate(start);
    setToDate(end);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Monthly Breakeven
          </h3>
          <p className="text-xs text-muted-foreground">
            Period: {fromStr} → {toStr} ({months.toFixed(1)} mo)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setShouldLoad(true); refetch(); }} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DateField label="From" value={fromDate} onChange={setFromDate} />
        <DateField label="To" value={toDate} onChange={setToDate} />
        <div className="ml-auto">
          <Select
            onValueChange={(v) => {
              if (v === "last") setLastMonth();
              else setPreset(Number(v));
            }}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Quick range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="1">This Month</SelectItem>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load breakeven"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating breakeven…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      ) : data ? (
        income <= 0 || grossMargin <= 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Not enough income or positive gross margin in this period to compute a breakeven.
            </span>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Performance
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Kpi label="Revenue" value={fmt(income)} />
                <Kpi label="Cost of Sales (Variable)" value={fmt(totalVariable)} />
                <Kpi label="Gross Profit Margin" value={pct(grossMargin)} />
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Accounting Break-Even
              </p>
              {(() => {
                const operatingResult = income - totalVariable - fixedOpex;
                const isProfit = operatingResult >= 0;
                const rows: { label: ReactNode; value: ReactNode; tone?: "positive" | "negative" }[] = [
                  { label: "Total Fixed Costs", value: fmt(fixedOpex) },
                  { label: "Gross Margin %", value: pct(grossMargin) },
                  {
                    label: (
                      <>
                        Break-Even Revenue{" "}
                        <span className="italic text-muted-foreground">
                          (Fixed Costs ÷ Gross Margin %)
                        </span>
                      </>
                    ),
                    value: fmt(breakevenRevenue),
                  },
                  { label: "Monthly Revenue", value: fmt(monthlyIncome) },
                  {
                    label: "Above or Below Break-Even?",
                    value: aboveBreakeven ? "Above" : "Below",
                    tone: aboveBreakeven ? "positive" : "negative",
                  },
                  {
                    label: isProfit ? "Operating Profit" : "Operating Loss",
                    value: fmt(operatingResult),
                    tone: isProfit ? "positive" : "negative",
                  },
                ];
                return (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <tbody>
                        {rows.map((r, i) => (
                          <tr
                            key={i}
                            className={cn(
                              i !== rows.length - 1 && "border-b border-border",
                            )}
                          >
                            <th
                              scope="row"
                              className="w-1/2 bg-muted/40 px-3 py-2 text-left font-medium text-foreground"
                            >
                              {r.label}
                            </th>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono tabular-nums",
                                r.tone === "positive" && "text-emerald-600 font-semibold",
                                r.tone === "negative" && "text-rose-600 font-semibold",
                              )}
                            >
                              {r.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>



            <details className="mt-3 rounded-lg border border-border/60 bg-background/50">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                Show calculation breakdown
              </summary>
              <div className="space-y-4 border-t border-border/60 px-3 py-3 text-xs">
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Formula
                  </p>
                  <p className="font-mono text-foreground">
                    Break-Even Revenue = Fixed Costs ÷ Gross Margin %
                  </p>
                  <p className="mt-1 font-mono text-muted-foreground">
                    {fmt(breakevenRevenue)} = {fmt(fixedOpex)} ÷ {pct(grossMargin)}
                  </p>
                </div>

                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Gross Margin %
                  </p>
                  <p className="font-mono text-foreground">
                    ({fmt(income)} − {fmt(totalVariable)}) ÷ {fmt(income)} = {pct(grossMargin)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Variable costs = Cost of Sales ({fmt(cogs)})
                    {variableOpex > 0 && <> + Variable opex ({fmt(variableOpex)})</>}
                  </p>
                </div>

                {(() => {
                  const fixedLinesSum = fixedLines.reduce((s, l) => s + l.amount, 0);
                  const fixedAdj = fixedOpex - fixedLinesSum;
                  const variableLinesSum = variableLines.reduce((s, l) => s + l.amount, 0);
                  const variableAdj = variableOpex - variableLinesSum;
                  const recomputedBreakeven =
                    grossMargin > 0 ? fixedOpex / grossMargin : 0;
                  const breakevenMatches =
                    Math.abs(recomputedBreakeven - breakevenRevenue) < 0.01;
                  return (
                    <>
                      <div>
                        <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                          <span>Fixed Costs ({fixedLines.length})</span>
                          <span>{fmt(fixedOpex)}</span>
                        </p>
                        {fixedLines.length === 0 ? (
                          <p className="text-muted-foreground">
                            No fixed cost accounts in this period.
                          </p>
                        ) : (
                          <ul className="divide-y divide-border/40">
                            {fixedLines.map((l) => (
                              <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                                <span className="truncate">
                                  {l.name}
                                  {l.unclassified && (
                                    <span className="ml-1.5 text-[10px] text-amber-600">
                                      (unclassified)
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono tabular-nums text-foreground">
                                  {fmt(l.amount)}
                                </span>
                              </li>
                            ))}
                            {Math.abs(fixedAdj) >= 0.5 && (
                              <li className="flex items-center justify-between gap-2 py-1 text-muted-foreground">
                                <span className="truncate italic">Rounding / unallocated</span>
                                <span className="font-mono tabular-nums">{fmt(fixedAdj)}</span>
                              </li>
                            )}
                            <li className="flex items-center justify-between gap-2 border-t border-border/60 py-1.5 font-medium">
                              <span>Total</span>
                              <span className="font-mono tabular-nums">{fmt(fixedOpex)}</span>
                            </li>
                          </ul>
                        )}
                      </div>

                      {variableLines.length > 0 && (
                        <div>
                          <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                            <span>Variable Opex ({variableLines.length})</span>
                            <span>{fmt(variableOpex)}</span>
                          </p>
                          <ul className="divide-y divide-border/40">
                            {variableLines.map((l) => (
                              <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                                <span className="truncate">{l.name}</span>
                                <span className="font-mono tabular-nums text-foreground">
                                  {fmt(l.amount)}
                                </span>
                              </li>
                            ))}
                            {Math.abs(variableAdj) >= 0.5 && (
                              <li className="flex items-center justify-between gap-2 py-1 text-muted-foreground">
                                <span className="truncate italic">Rounding / unallocated</span>
                                <span className="font-mono tabular-nums">{fmt(variableAdj)}</span>
                              </li>
                            )}
                            <li className="flex items-center justify-between gap-2 border-t border-border/60 py-1.5 font-medium">
                              <span>Total</span>
                              <span className="font-mono tabular-nums">{fmt(variableOpex)}</span>
                            </li>
                          </ul>
                        </div>
                      )}

                      <div
                        className={cn(
                          "flex items-start gap-2 rounded-md border p-2 text-[11px]",
                          breakevenMatches
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                            : "border-rose-500/30 bg-rose-500/5 text-rose-900 dark:text-rose-200",
                        )}
                      >
                        <span className="font-medium">
                          {breakevenMatches ? "✓ Reconciles:" : "✗ Mismatch:"}
                        </span>
                        <span className="font-mono">
                          {fmt(fixedOpex)} ÷ {pct(grossMargin)} ={" "}
                          {fmt(recomputedBreakeven)}
                          {breakevenMatches
                            ? ` (matches Break-Even Revenue of ${fmt(breakevenRevenue)})`
                            : ` (displayed: ${fmt(breakevenRevenue)})`}
                        </span>
                      </div>
                    </>
                  );
                })()}

              </div>
            </details>




            {clientId && classificationEnabled && unclassifiedCount > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                  <strong>{unclassifiedCount}</strong> expense {unclassifiedCount === 1 ? "account is" : "accounts are"} unclassified and treated as fixed.{" "}
                  <Link
                    to="/clients/$clientId/settings"
                    params={{ clientId }}
                    hash="cost-classification"
                    className="font-medium underline underline-offset-2"
                  >
                    Classify accounts
                  </Link>
                </div>
              </div>
            )}

            {classificationEnabled && excludedCount > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Excluding {excludedCount} account{excludedCount === 1 ? "" : "s"} ({fmt(excludedOpex)}) from breakeven.
              </p>
            )}

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Monthly progress to breakeven
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  {coverage.toFixed(2)}× covered
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                    aboveBreakeven ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>Avg income/mo: {fmt(monthlyIncome)}</span>
                <span>Target/mo: {fmt(monthlyBreakeven)}</span>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-muted-foreground">
              Monthly breakeven = Fixed Costs ÷ Gross Margin ÷ months.{" "}
              {classificationEnabled ? (
                <>
                  Cost of Sales plus any expense accounts you tag as <strong>Variable</strong> are
                  treated as variable; accounts tagged <strong>Excluded</strong> are left out
                  entirely; everything else is fixed.
                </>
              ) : (
                <>
                  Cost classification is off — Cost of Sales is treated as variable and all operating
                  expenses as fixed.
                </>
              )}
              {clientId && (
                <>
                  {" "}
                  <Link
                    to="/clients/$clientId/settings"
                    params={{ clientId }}
                    hash="cost-classification"
                    className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
                  >
                    <Settings2 className="h-3 w-3" /> Cost classification settings
                  </Link>
                </>
              )}
            </p>
          </>
        )
      ) : null}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-normal">
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {format(value, "d MMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
