import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getCurrentTaxBalance } from "@/lib/xero/reports.functions";
import { Loader2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { DateField, toISO, usePersistedDate } from "@/components/dashboard/DateRangeControls";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SuperannuationWidget({
  tenantId,
  tenantName,
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
}) {
  const fetchBalance = useServerFn(getCurrentTaxBalance);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const [asAt, setAsAt] = usePersistedDate(`super-liability-as-at:${tenantId}`, () => new Date());
  const asAtIso = toISO(asAt);

  const balanceQ = useQuery({
    queryKey: ["xero-super-balance", tenantId, asAtIso],
    queryFn: () => fetchBalance({ data: { tenantId, date: asAtIso } }),
    enabled: shouldLoad,
    retry: false,
  });

  const isLoading = balanceQ.isLoading;
  const isFetching = balanceQ.isFetching;
  const error = balanceQ.error;
  const bal = balanceQ.data;
  const superLines = bal?.lines.filter((l) => l.category === "super") ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold">Superannuation liabilities</h3>
          <p className="text-xs text-muted-foreground">
            Balance as at {format(asAt, "d MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShouldLoad(true); balanceQ.refetch(); }}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DateField label="As at" value={asAt} onChange={setAsAt} />
      </div>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load super data"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => balanceQ.refetch()} isRetrying={isFetching} />
      ) : bal ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Super Payable
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                {fmt(bal.superannuation)}
              </p>
            </div>
          </div>

          {superLines.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
              No superannuation accounts found on the balance sheet.
            </p>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Breakdown
              </p>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                {superLines.map((l) => (
                  <li key={l.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{l.name}</span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
