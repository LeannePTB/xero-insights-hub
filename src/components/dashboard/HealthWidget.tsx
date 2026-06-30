import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { getBusinessHealth } from "@/lib/health.functions";
import { useTenantCurrency, formatMoney } from "./useTenantCurrency";
import { HealthScoreDonut } from "./HealthScoreDonut";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeControls, usePersistedDate, toISO } from "./DateRangeControls";
import { HealthPillars } from "./HealthPillars";

function fyStartDefault(): Date {
  const t = new Date();
  const startYear = t.getMonth() >= 6 ? t.getFullYear() : t.getFullYear() - 1;
  return new Date(startYear, 6, 1);
}

type Props = {
  tenantId?: string;
  tenantName?: string;
  clientName?: string;
  clientId?: string;
};

export function HealthWidget({ tenantId, tenantName, clientName, clientId }: Props) {
  const fetchHealth = useServerFn(getBusinessHealth);
  const currency = useTenantCurrency(tenantId);
  const [fromDate, setFromDate] = usePersistedDate(
    `health:from:${tenantId ?? "none"}`,
    fyStartDefault,
  );
  const [toDate, setToDate] = usePersistedDate(
    `health:to:${tenantId ?? "none"}`,
    () => new Date(),
  );

  const q = useQuery({
    queryKey: ["business-health", tenantId, toISO(fromDate), toISO(toDate)],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchHealth({
        data: { tenantId: tenantId!, fromDate: toISO(fromDate), toDate: toISO(toDate) },
      }),
  });

  if (!tenantId) {
    return <Placeholder tenantName={tenantName} />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {[clientName, tenantName, currency, q.data?.fyLabel].filter(Boolean).join(" · ")}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Business Health
          </h3>
        </div>
      </div>

      <DateRangeControls
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
      />



      {q.isLoading && <LoadingState />}
      {q.error && (
        <p className="mt-4 text-sm text-destructive">
          Couldn't load business health: {(q.error as Error).message}
        </p>
      )}

      {q.data && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            <HealthScoreDonut score={q.data.score} band={q.data.band} />
            <div className="min-w-0 flex-1">
              <p
                className={
                  "font-display text-lg font-semibold " +
                  (q.data.band === "strong"
                    ? "text-foreground"
                    : q.data.band === "watch"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-destructive")
                }
              >
                {q.data.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{q.data.summary}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                <RefreshCw className="h-3 w-3" /> Live from Xero · {formatDate(q.data.asOfDate)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Revenue (FY)" value={formatMoney(q.data.revenue, currency)} />
            <Kpi label="Gross margin" value={`${q.data.grossMarginPct.toFixed(1)}%`} />
            <Kpi
              label="Net profit"
              value={formatMoney(q.data.netProfit, currency)}
              tone={q.data.netProfit < 0 ? "danger" : undefined}
            />
            <Kpi
              label="Cash in bank"
              value={formatMoney(q.data.cashInBank, currency)}
              tone={q.data.cashInBank < 5000 ? "danger" : undefined}
            />
            <Kpi label="Owed to you" value={formatMoney(q.data.owedToYou, currency)} />
          </div>

          {q.data.alert && (
            <div
              className={
                "mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm " +
                (q.data.alert.severity === "danger"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100")
              }
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">{q.data.alert.title}</p>
                <p className="mt-0.5 opacity-90">{q.data.alert.body}</p>
              </div>
            </div>
          )}

          <HealthPillars tenantId={tenantId} clientId={clientId} />
        </>
      )}
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
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 font-display text-lg font-semibold tabular-nums " +
          (tone === "danger" ? "text-destructive" : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-5">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function Placeholder({ tenantName }: { tenantName?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <p className="text-xs text-muted-foreground">{tenantName}</p>
      <h3 className="font-display text-lg font-semibold flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" /> Business Health
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Link a Xero organisation to see the business health overview.
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
