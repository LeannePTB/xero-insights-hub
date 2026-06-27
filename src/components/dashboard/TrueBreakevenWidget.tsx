import { Loader2, RefreshCw, Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { DateRangeControls } from "@/components/dashboard/DateRangeControls";
import { TrueBreakevenSection } from "@/components/dashboard/TrueBreakevenSection";
import { useBreakevenData } from "@/components/dashboard/useBreakevenData";

export function TrueBreakevenWidget({
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> True Break-Even (Cash)
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
          label="Load true break-even"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => s.setShouldLoad(true)}
        />
      ) : s.isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating…
        </div>
      ) : s.error ? (
        <XeroErrorNotice error={s.error} onRetry={() => s.refetch()} isRetrying={s.isFetching} />
      ) : s.data ? (
        s.income <= 0 || s.grossMargin <= 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Not enough income or positive gross margin in this period to compute a true break-even.</span>
          </div>
        ) : clientId ? (
          <TrueBreakevenSection
            clientId={clientId}
            tenantId={tenantId}
            fixedOpex={s.fixedOpex}
            grossMargin={s.grossMargin}
            monthlyIncome={s.monthlyIncome}
            months={s.months}
            toDateISO={s.toStr}
          />
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Client context required for True Break-Even inputs.</p>
        )
      ) : null}
    </div>
  );
}
