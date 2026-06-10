import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getProfitAndLoss } from "@/lib/xero/reports.functions";
import {
  Loader2,
  Target,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  return d.toISOString().slice(0, 10);
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
  // Fractional months for partial periods
  const ms = to.getTime() - from.getTime();
  const fractional = ms / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0.1, Math.max(months, fractional));
}

export function BreakevenWidget({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const fetchPnl = useServerFn(getProfitAndLoss);
  const [fromDate, setFromDate] = useState<Date>(startOfThisMonth());
  const [toDate, setToDate] = useState<Date>(endOfThisMonth());

  const fromStr = toISO(fromDate);
  const toStr = toISO(toDate);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-pnl", tenantId, fromStr, toStr],
    queryFn: () => fetchPnl({ data: { tenantId, fromDate: fromStr, toDate: toStr, widget: "breakeven" } }),
  });

  const income = data?.totalIncome ?? 0;
  const cogs = data?.totalCostOfSales ?? 0;
  const opex = data?.totalExpenses ?? 0;
  const months = monthsBetween(fromDate, toDate);
  const grossMargin = income > 0 ? (income - cogs) / income : 0;
  const breakevenRevenue = grossMargin > 0 ? opex / grossMargin : 0;
  const monthlyBreakeven = breakevenRevenue / months;
  const monthlyFixed = opex / months;
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
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DateField label="From" value={fromDate} onChange={setFromDate} />
        <DateField label="To" value={toDate} onChange={setToDate} />
        <div className="ml-auto flex gap-1">
          <PresetBtn onClick={() => setPreset(1)}>1M</PresetBtn>
          <PresetBtn onClick={() => setPreset(3)}>3M</PresetBtn>
          <PresetBtn onClick={() => setPreset(6)}>6M</PresetBtn>
          <PresetBtn onClick={() => setPreset(12)}>12M</PresetBtn>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating breakeven…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
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
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Breakeven / mo" value={fmt(monthlyBreakeven)} />
              <Kpi label="Gross Margin" value={pct(grossMargin)} />
              <Kpi label="Fixed Costs / mo" value={fmt(monthlyFixed)} />
              <Kpi
                label={aboveBreakeven ? "Surplus / mo" : "Shortfall / mo"}
                value={fmt(Math.abs(surplus))}
                tone={aboveBreakeven ? "positive" : "negative"}
              />
            </div>

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
              Monthly breakeven = (Operating Expenses ÷ Gross Margin) ÷ months in period. Cost of Sales is
              treated as variable; all other operating expenses are treated as fixed.
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

function PresetBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </button>
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
