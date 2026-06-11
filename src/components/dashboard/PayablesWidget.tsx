import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getAgedPayables } from "@/lib/xero/payables.functions";
import { Loader2, RefreshCw, Wallet, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function fmt(n: number) {

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

const BUCKET_TONES: Record<string, string> = {
  Current: "bg-emerald-500",
  "1–30 days": "bg-amber-400",
  "31–60 days": "bg-amber-500",
  "61–90 days": "bg-orange-500",
  "90+ days": "bg-rose-600",
};

export function PayablesWidget({ tenantId, tenantName, clientId }: { tenantId: string; tenantName: string; clientId: string }) {
  const fetchAP = useServerFn(getAgedPayables);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-ap-ageing", tenantId],
    queryFn: () => fetchAP({ data: { tenantId } }),
    retry: false,
  });

  const maxBucket = Math.max(...(data?.buckets ?? []).map((b) => b.amount), 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Accounts Payable Ageing
          </h3>
          <p className="text-xs text-muted-foreground">
            Unpaid supplier bills · as of {data?.asOf ?? "—"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payables…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : data ? (
        data.totalOutstanding === 0 ? (
          <div className="mt-6 flex items-center justify-center rounded-lg bg-muted/40 p-6 text-sm text-muted-foreground">
            No outstanding bills. You're all paid up.
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Kpi label="Outstanding" value={fmt(data.totalOutstanding)} />
              <Kpi
                label="Overdue"
                value={fmt(data.totalOverdue)}
                tone={data.totalOverdue > 0 ? "negative" : undefined}
              />
              <Kpi label="Open Bills" value={String(data.invoiceCount)} />
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ageing buckets
              </p>
              {data.buckets.map((b) => (
                <div key={b.label} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{b.label}</span>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${BUCKET_TONES[b.label] ?? "bg-primary"}`}
                      style={{ width: `${b.amount === 0 ? 0 : Math.max(4, (b.amount / maxBucket) * 100)}%` }}
                    />
                  </div>
                  <span className="text-right font-medium">
                    {fmt(b.amount)}
                    <span className="ml-1 text-muted-foreground">({b.count})</span>
                  </span>
                </div>
              ))}
            </div>

            {data.topSuppliers.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top suppliers owed
                </p>
                <div className="space-y-1.5">
                  {data.topSuppliers.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="truncate pr-2 text-foreground">{s.name}</span>
                      <span className="font-medium">{fmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.totalOverdue > 0 && (
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-rose-600">
                <AlertCircle className="h-3 w-3" />
                {fmt(data.totalOverdue)} is past its due date.
              </p>
            )}
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                to="/clients/$clientId/payables/$tenantId"
                params={{ clientId, tenantId }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all payables <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

          </>
        )
      ) : null}
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
  tone?: "negative";
}) {
  const toneClass = tone === "negative" ? "text-rose-600" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
