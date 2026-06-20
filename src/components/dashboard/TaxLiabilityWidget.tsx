import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getTaxLiabilityBuckets } from "@/lib/xero/reports.functions";
import { CheckCircle2, AlertTriangle, Loader2, Receipt, RefreshCw } from "lucide-react";
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

const CATEGORY_LABEL: Record<string, string> = {
  gst: "GST",
  payg: "PAYG",
  super: "Super",
  "other-tax": "Other tax",
};

const BUCKET_LABEL: Record<string, string> = {
  "not-due": "Not due",
  due: "Due",
  overdue: "Overdue",
};

const BUCKET_STYLES: Record<string, string> = {
  "not-due": "bg-muted text-muted-foreground",
  due: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  overdue: "bg-destructive/15 text-destructive",
};

export function TaxLiabilityWidget({
  tenantId,
  tenantName,
  loadDelayMs = 0,
}: {
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
}) {
  const fetchBuckets = useServerFn(getTaxLiabilityBuckets);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const [asAt, setAsAt] = usePersistedDate(`tax-liability-as-at:${tenantId}`, () => new Date());
  const asAtIso = toISO(asAt);

  const balanceQ = useQuery({
    queryKey: ["xero-tax-buckets", tenantId, asAtIso],
    queryFn: () => fetchBuckets({ data: { tenantId, date: asAtIso } }),
    enabled: shouldLoad,
    retry: false,
  });

  const isLoading = balanceQ.isLoading;
  const isFetching = balanceQ.isFetching;
  const error = balanceQ.error;
  const bal = balanceQ.data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold">Tax liabilities</h3>
            {bal?.basis ? (
              <span
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                title="Xero reporting basis"
              >
                {bal.basis}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Balance as at {format(asAt, "d MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShouldLoad(true);
              balanceQ.refetch();
            }}
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
          label="Load tax data"
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
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <BucketKpi label="Not yet due" value={bal.notYetDue} tone="neutral" />
            <BucketKpi label="Due now" value={bal.dueNow} tone="due" />
            <BucketKpi label="Overdue" value={bal.overdue} tone="overdue" />
          </div>

          <ReconciliationStrip
            bucketTotal={bal.bucketTotal}
            balanceSheetTotal={bal.balanceSheetTotal}
            difference={bal.difference}
          />

          {bal.asUnavailable && bal.asMessage ? (
            <p className="mt-3 rounded-lg border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
              {bal.asMessage}
            </p>
          ) : null}

          {bal.lines.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
              No GST or PAYG accounts found on the balance sheet.
            </p>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Balance sheet breakdown
              </p>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                {bal.lines.map((l) => (
                  <li
                    key={l.name}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABEL[l.category] ?? l.category}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          BUCKET_STYLES[l.bucket]
                        }`}
                      >
                        {BUCKET_LABEL[l.bucket]}
                      </span>
                      <span className="font-medium tabular-nums">{fmt(l.balanceSheetAmount)}</span>
                    </div>
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

function BucketKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "due" | "overdue";
}) {
  const styles =
    tone === "overdue" && value > 0
      ? "border-destructive/30 bg-destructive/5"
      : tone === "due" && value > 0
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border/60 bg-background";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{fmt(value)}</p>
    </div>
  );
}

function ReconciliationStrip({
  bucketTotal,
  balanceSheetTotal,
  difference,
}: {
  bucketTotal: number;
  balanceSheetTotal: number;
  difference: number;
}) {
  const balanced = Math.abs(difference) < 1;
  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
        balanced
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      <div className="flex items-center gap-2">
        {balanced ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
        <span className="font-medium">
          {balanced ? "Reconciles to balance sheet" : "Doesn't reconcile to balance sheet"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
        <span>
          Buckets: <span className="font-medium text-foreground">{fmt(bucketTotal)}</span>
        </span>
        <span>
          Balance sheet: <span className="font-medium text-foreground">{fmt(balanceSheetTotal)}</span>
        </span>
        <span>
          Diff:{" "}
          <span className={`font-medium ${balanced ? "text-foreground" : "text-amber-600 dark:text-amber-400"}`}>
            {fmt(difference)}
          </span>
        </span>
      </div>
    </div>
  );
}
