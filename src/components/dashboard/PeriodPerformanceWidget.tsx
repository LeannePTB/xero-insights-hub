import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { DateRangeControls } from "@/components/dashboard/DateRangeControls";
import { cn } from "@/lib/utils";
import { useBreakevenData, fmtAUD, fmtPct } from "@/components/dashboard/useBreakevenData";

export function PeriodPerformanceWidget({
  tenantId,
  tenantName,
  clientId,
  loadDelayMs = 0,
  basis = "accrual",
}: {
  tenantId: string;
  tenantName: string;
  clientId?: string;
  loadDelayMs?: number;
  basis?: "accrual" | "cash";
}) {
  const s = useBreakevenData({ tenantId, clientId, basis, loadDelayMs });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Period Performance
            <BasisBadge basis={basis} />
          </h3>
          <p className="text-xs text-muted-foreground">
            Period: {s.fromStr} → {s.toStr} ({s.months.toFixed(1)} mo)
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { s.setShouldLoad(true); s.refetch(); }} disabled={s.isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${s.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <DateRangeControls
        fromDate={s.fromDate}
        toDate={s.toDate}
        onFromChange={s.setFromDate}
        onToChange={s.setToDate}
      />

      {!s.shouldLoad ? (
        <XeroLoadPrompt
          label="Load period performance"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => s.setShouldLoad(true)}
        />
      ) : s.isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : s.error ? (
        <XeroErrorNotice error={s.error} onRetry={() => s.refetch()} isRetrying={s.isFetching} />
      ) : s.data ? (
        <div className="mt-6">
          <div className={cn("grid gap-3", s.variableOpex > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
            <Kpi label="Revenue" value={fmtAUD(s.income)} />
            <Kpi label="Cost of Sales" value={fmtAUD(s.cogs)} />
            {s.variableOpex > 0 && <Kpi label="Variable Opex" value={fmtAUD(s.variableOpex)} />}
            <Kpi label="Gross Profit Margin" value={fmtPct(s.grossMargin)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
