import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Info } from "lucide-react";
import { DashboardCardHeader } from "./DashboardCardHeader";
import { XeroErrorNotice } from "./XeroLoadState";
import { Skeleton } from "@/components/ui/skeleton";
import { getHealthChecks } from "@/lib/health.functions";
import { STATUS_LABEL, type CheckStatus } from "@/lib/health/health-checks";

type Props = {
  tenantId?: string;
  tenantName?: string;
  clientName?: string;
  clientId?: string;
  /** Released to Business Owners (System Admin setting). */
  released?: boolean;
};

const PILL: Record<CheckStatus, string> = {
  green: "border-success/30 bg-success/10 text-success",
  watch: "border-info/30 bg-info/10 text-info",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
  na: "border-border bg-muted/40 text-muted-foreground",
};

/** Light status tint for each check tile; text stays on the default foreground for AA contrast. */
const TILE: Record<CheckStatus, string> = {
  green: "border-success/30 bg-success/5",
  watch: "border-info/30 bg-info/5",
  red: "border-destructive/30 bg-destructive/5",
  na: "border-border/60 bg-background/60",
};

/** Business Health: three plain checks from last night's saved Xero figures. */
export function HealthWidget({ tenantId, tenantName, clientName, clientId, released }: Props) {
  const fetchChecks = useServerFn(getHealthChecks);
  const q = useQuery({
    queryKey: ["health-checks", tenantId, clientId],
    enabled: !!tenantId && !!clientId,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchChecks({ data: { tenantId: tenantId ?? "", clientId: clientId ?? "" } }),
  });

  if (!tenantId || !clientId) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 shadow-soft">
        <p className="text-xs text-muted-foreground">{tenantName}</p>
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-emphasis" /> Business health
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">Link a Xero organisation to see business health.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader
        label={[clientName, tenantName?.trim().toLowerCase() !== clientName?.trim().toLowerCase() ? tenantName : null, q.data?.fyLabel].filter(Boolean).join(" · ")}
        title="Business health"
        icon={<Activity className="h-4 w-4" />}
        description="Three quick checks on profit, cash and getting paid"
        source={q.data?.source}
        isFetching={q.isFetching}
        actions={q.data ? <span className="font-display text-sm font-semibold text-foreground">{q.data.headline}</span> : undefined}
        badge={!released ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Practice only — not visible to clients</span> : undefined}
      />

      {q.isLoading && (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-6 w-40" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}
      {!!q.error && !q.data && <XeroErrorNotice error={q.error} onRetry={() => q.refetch()} isRetrying={q.isFetching} />}

      {q.data && (
        <>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {q.data.checks.map((c) => (
              <li key={c.key} className={`flex flex-col rounded-xl border p-2.5 ${TILE[c.status]}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-medium text-foreground">{c.question}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PILL[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="mt-0.5 font-display text-base font-semibold tabular-nums text-foreground">{c.figure}</p>
                {c.detail && <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{c.meaning}</p>
              </li>
            ))}
          </ul>
          {q.data.info.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {q.data.info.map((line) => (
                <span key={line.key} className="inline-flex items-start gap-1">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{line.text}</span>
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </div>
  );
}
