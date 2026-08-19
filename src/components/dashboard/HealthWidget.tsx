import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { getBusinessHealthDetail } from "@/lib/health.functions";
import { useTenantCurrency } from "./useTenantCurrency";
import { HealthScoreDonut } from "./HealthScoreDonut";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeControls, usePersistedDate, toISO } from "./DateRangeControls";
import { HealthPillars } from "./HealthPillars";

function fyStartDefault(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), 1);
}
function endOfThisMonth(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth() + 1, 0);
}

type Props = {
  tenantId?: string;
  tenantName?: string;
  clientName?: string;
  clientId?: string;
};

export function HealthWidget({ tenantId, tenantName, clientName, clientId }: Props) {
  // One server call powers the score, the drivers and the pillars, so the
  // current-period P&L is fetched once instead of twice.
  const fetchHealth = useServerFn(getBusinessHealthDetail);
  const currency = useTenantCurrency(tenantId);
  const [fromDate, setFromDate] = usePersistedDate(
    `health:from:${tenantId ?? "none"}`,
    fyStartDefault,
  );
  const [toDate, setToDate] = usePersistedDate(
    `health:to:${tenantId ?? "none"}`,
    endOfThisMonth,
  );

  const q = useQuery({
    queryKey: ["business-health", tenantId, clientId, toISO(fromDate), toISO(toDate)],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchHealth({
        data: {
          tenantId: tenantId!,
          clientId,
          fromDate: toISO(fromDate),
          toDate: toISO(toDate),
        },
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  <RefreshCw className="h-3 w-3" /> Live from Xero · {formatDate(q.data.asOfDate)}
                </span>
              </div>
              {q.data.alert && (
                <div
                  className={
                    "mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs " +
                    (q.data.alert.severity === "danger"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100")
                  }
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{q.data.alert.title}</p>
                    <p className="mt-0.5 opacity-90">{q.data.alert.body}</p>
                  </div>
                </div>
              )}
            </div>
          </div>


          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What the score is made of
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Driver
                label="Net margin"
                value={`${q.data.drivers.netMarginPct.toFixed(1)}%`}
                tone={q.data.drivers.netMarginPct < 0 ? "danger" : undefined}
              />
              <Driver
                label="Gross margin"
                value={`${q.data.drivers.grossMarginPct.toFixed(1)}%`}
              />
              <Driver
                label="Bad debts (% of revenue)"
                value={`${q.data.drivers.badDebtsPctOfRevenue.toFixed(1)}%`}
                tone={q.data.drivers.badDebtsPctOfRevenue >= 3 ? "danger" : undefined}
              />
              <Driver
                label="Runway"
                value={
                  q.data.drivers.monthsRunway === null
                    ? "Not available"
                    : `${q.data.drivers.monthsRunway.toFixed(1)} months`
                }
                note={
                  q.data.drivers.monthsRunway === null
                    ? "Operating costs couldn't be derived, so the score uses a neutral stability of 50."
                    : undefined
                }
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Dollar figures live in the Profit &amp; Loss card.
            </p>
          </div>

          <HealthPillars pillars={q.data.pillars} clientId={clientId} />
        </>
      )}
    </div>
  );
}

function Driver({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "danger";
  note?: string;
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
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
