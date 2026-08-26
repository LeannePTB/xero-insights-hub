// The merged Tax liabilities + Superannuation card.
//
// One balance sheet read, one implementation: `getProtectedMoney` already
// returned GST, PAYG and super together, with the resolved/unresolved
// distinction that keeps "no matching account" separate from a real zero.
// Two cards previously fetched the same Balance Sheet twice and could show
// different as-at dates on one screen.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getProtectedMoney } from "@/lib/xero/reports.functions";
import { HelpCircle, Loader2, PiggyBank, Receipt, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { DateField, toISO, usePersistedDate } from "@/components/dashboard/DateRangeControls";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const COMPONENT_ICON = {
  gst: Receipt,
  payg: Wallet,
  super: PiggyBank,
} as const;

export function ProtectedMoneyWidget({
  tenantId,
  tenantName,
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
}) {
  const fetchProtected = useServerFn(getProtectedMoney);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const [asAt, setAsAt] = usePersistedDate(`protected-money-as-at:${tenantId}`, () => new Date());
  const asAtIso = toISO(asAt);

  const q = useQuery({
    queryKey: ["xero-protected-money", tenantId, asAtIso],
    queryFn: () => fetchProtected({ data: { tenantId, date: asAtIso } }),
    enabled: shouldLoad,
    retry: false,
  });

  const data = q.data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Wallet className="h-4 w-4 text-primary" /> Money held for someone else
          </h3>
          <p className="text-xs text-muted-foreground">
            GST, PAYG withholding and superannuation as at {format(asAt, "d MMM yyyy")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShouldLoad(true);
            q.refetch();
          }}
          disabled={q.isFetching}
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DateField label="As at" value={asAt} onChange={setAsAt} />
      </div>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load balances"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : q.isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : q.error ? (
        <XeroErrorNotice error={q.error} onRetry={() => q.refetch()} isRetrying={q.isFetching} />
      ) : data ? (
        <>
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total held for others
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{fmt(data.total)}</p>
            {!data.complete ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sum of the components that could be identified on the balance sheet. Anything unidentified is
                excluded rather than counted as zero.
              </p>
            ) : null}
          </div>

          <ul className="mt-4 space-y-2">
            {data.components.map((c) => {
              const Icon = COMPONENT_ICON[c.key];
              return (
                <li key={c.key} className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 text-sm">{c.label}</span>
                    </div>
                    {c.status === "resolved" ? (
                      <span className="shrink-0 font-medium tabular-nums">{fmt(c.amount)}</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <HelpCircle className="h-3.5 w-3.5" /> Not identified
                      </span>
                    )}
                  </div>

                  {c.status === "resolved" && c.accounts.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border/40 border-t border-border/40 pt-1">
                      {c.accounts.map((a) => (
                        <li key={a.name} className="flex items-center justify-between gap-3 py-1 text-xs">
                          <span className="truncate text-muted-foreground">{a.name}</span>
                          <span className="shrink-0 tabular-nums">{fmt(a.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {c.status === "unresolved" ? (
                    <p className="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                      {c.reason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
