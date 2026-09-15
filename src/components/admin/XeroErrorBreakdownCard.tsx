import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getXeroErrorBreakdown, type XeroErrorBreakdownRow } from "@/lib/xero-errors.functions";
import { XeroApiErrorsSheet } from "@/components/admin/XeroApiErrorsSheet";

/**
 * Xero API failures, per organisation and per Xero file.
 *
 * Moved here from the Organisations table: a failure count is monitoring, not
 * subscription information. Telemetry only — endpoint path and HTTP status,
 * never payloads, tokens or client figures. The database function
 * (public.xero_error_breakdown) re-checks aal2 and the super-admin role, so
 * this is Path C platform metadata.
 */
function fmt(s: string) {
  return new Date(s).toLocaleString();
}

export function XeroErrorBreakdownCard() {
  const [days, setDays] = useState<7 | 30>(7);
  const fetchBreakdown = useServerFn(getXeroErrorBreakdown);
  const q = useQuery({
    queryKey: ["xero-error-breakdown", days],
    queryFn: () => fetchBreakdown({ data: { days } }),
  });

  const rows = q.data?.breakdown ?? [];
  const total = rows.reduce((n, r) => n + r.count, 0);
  const rateLimited = rows.reduce((n, r) => n + r.rateLimited, 0);

  // Organisation -> Xero file -> failures, so it reads as "who and which file".
  const byOrg = new Map<string, Map<string, XeroErrorBreakdownRow[]>>();
  for (const r of rows) {
    const files = byOrg.get(r.organisation) ?? new Map<string, XeroErrorBreakdownRow[]>();
    files.set(r.xeroFile, [...(files.get(r.xeroFile) ?? []), r]);
    byOrg.set(r.organisation, files);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Xero API failures</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Calls to Xero that failed, by organisation and Xero file. Status codes and endpoints
            only — no client figures are recorded. Identical failures are grouped, so each count is
            failure windows rather than every attempt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={days === 7 ? "default" : "outline"} onClick={() => setDays(7)}>
            7 days
          </Button>
          <Button size="sm" variant={days === 30 ? "default" : "outline"} onClick={() => setDays(30)}>
            30 days
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading failures…
        </p>
      ) : q.error ? (
        <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
          <p className="mt-2 text-sm font-medium">No Xero failures in the last {days} days.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="tabular-nums font-medium">{total}</span>
            <span className="text-muted-foreground">failures in {days} days</span>
            {rateLimited > 0 ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {rateLimited} refused for exceeding Xero's request allowance
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                none refused for exceeding Xero's request allowance
              </Badge>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {Array.from(byOrg.entries()).map(([org, files]) => {
              const orgTotal = Array.from(files.values())
                .flat()
                .reduce((n, r) => n + r.count, 0);
              const firmId = Array.from(files.values()).flat()[0]?.firmId ?? null;
              return (
                <div key={org} className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    <p className="text-sm font-medium">{org}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {orgTotal} failure{orgTotal === 1 ? "" : "s"} · {files.size} Xero file
                        {files.size === 1 ? "" : "s"}
                      </span>
                      <XeroApiErrorsSheet
                        firmId={firmId}
                        organisationName={org}
                        trigger={
                          <button type="button" className="text-xs text-primary underline underline-offset-4">
                            Details
                          </button>
                        }
                      />
                    </div>
                  </div>
                  <ul className="divide-y divide-border">
                    {Array.from(files.entries()).map(([file, list]) => (
                      <li key={file} className="px-4 py-3">
                        <p className="text-sm font-medium">{file}</p>
                        <ul className="mt-1 space-y-1">
                          {list.map((r) => (
                            <li key={r.key} className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge
                                variant="outline"
                                className={
                                  r.status === 429
                                    ? "border-destructive/40 text-destructive"
                                    : "text-muted-foreground"
                                }
                              >
                                HTTP {r.status ?? "—"}
                              </Badge>
                              <code className="text-muted-foreground">{r.path}</code>
                              <span className="tabular-nums font-medium">{r.count}×</span>
                              <span className="text-muted-foreground">
                                last {fmt(r.lastSeen)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
