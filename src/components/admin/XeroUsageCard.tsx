/**
 * Xero API usage against Xero's own limits (super admin only).
 *
 * Path C platform metadata: our own request volume and the quota Xero reports
 * back. Nothing from any client's financial data, and no tokens. Authorisation
 * is the database function behind `listXeroRateLimits`.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { SuperAdminSection } from "@/components/admin/SuperAdminOnly";
import { listXeroRateLimits } from "@/lib/xero-rate-limits.functions";

// Xero's published per-organisation limits, used only to show a remaining
// figure as a share of the allowance.
const DAY_LIMIT = 5000;
const MINUTE_LIMIT = 60;
const BURST_LIMIT = 300;

function pct(remaining: number | null, cap: number): number | null {
  if (remaining === null) return null;
  return Math.round((remaining / cap) * 100);
}

function tone(p: number | null): string {
  if (p === null) return "text-muted-foreground";
  if (p < 5) return "text-destructive font-medium";
  if (p < 20) return "text-amber-600 dark:text-amber-500 font-medium";
  return "text-foreground";
}

export function XeroUsageCard() {
  const fetchRows = useServerFn(listXeroRateLimits);
  const q = useQuery({
    queryKey: ["xero-rate-limits"],
    queryFn: () => fetchRows(),
    retry: false,
  });

  const rows = q.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <SuperAdminSection title="Xero request allowance">
      <div className="px-3 pb-3">
        <p className="mb-3 text-xs text-muted-foreground">
          What Xero itself reports as remaining for each connected file — {DAY_LIMIT.toLocaleString()}{" "}
          requests a day and {MINUTE_LIMIT} a minute per file. The lowest point reached is shown, not
          an average, so a short burst is still visible. More than{" "}
          {BURST_LIMIT.toLocaleString()} requests for one file in an hour usually means something is
          looping.
        </p>

        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.error && (
          <p className="text-sm text-muted-foreground">Xero usage figures are unavailable.</p>
        )}

        {!q.isLoading && !q.error && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No Xero requests recorded yet today or yesterday.
          </p>
        )}

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r) => {
              const dayPct = pct(r.dayRemaining, DAY_LIMIT);
              const minPct = pct(r.minuteRemaining, MINUTE_LIMIT);
              return (
                <li
                  key={r.key}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.file}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.organisation}
                      {r.day === today ? " · today" : " · yesterday"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
                    <span className={tone(dayPct)}>
                      Day remaining:{" "}
                      {r.dayRemaining === null ? "—" : `${r.dayRemaining.toLocaleString()} (${dayPct}%)`}
                    </span>
                    <span className={tone(minPct)}>
                      Lowest in a minute: {r.minuteRemaining === null ? "—" : `${r.minuteRemaining}`}
                    </span>
                    <span className="text-muted-foreground">
                      Requests seen: {r.calls.toLocaleString()}
                    </span>
                    <span
                      className={
                        r.peakHourCalls > BURST_LIMIT
                          ? "text-destructive font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      Busiest hour: {r.peakHourCalls.toLocaleString()}
                    </span>
                    {r.rejections > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {r.rejections} paused by Xero
                        {r.lastProblem ? ` (${r.lastProblem} limit)` : ""}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SuperAdminSection>
  );
}
