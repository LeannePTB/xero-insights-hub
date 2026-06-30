import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLatestAudit, runXeroAudit, snoozeFinding, unsnoozeFinding } from "@/lib/xero/audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Loader2, ExternalLink, BellOff, Bell, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$clientId/audit/$tenantId")({
  head: () => ({ meta: [{ title: "Xero file audit — Traction Advisory" }] }),
  component: AuditPage,
});

const CAT_LABEL: Record<string, string> = {
  coa: "Chart of accounts",
  bank: "Bank & reconciliation",
  ar_ap: "AR / AP",
  tax: "Tax / GST",
};
const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function AuditPage() {
  const { clientId, tenantId } = Route.useParams();
  const qc = useQueryClient();
  const fetchLatest = useServerFn(getLatestAudit);
  const runFn = useServerFn(runXeroAudit);
  const snoozeFn = useServerFn(snoozeFinding);
  const unsnoozeFn = useServerFn(unsnoozeFinding);

  const [catFilter, setCatFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [showSnoozed, setShowSnoozed] = useState(false);

  const q = useQuery({
    queryKey: ["xero-audit-latest", tenantId],
    queryFn: () => fetchLatest({ data: { tenantId } }),
  });

  const runMut = useMutation({
    mutationFn: () => runFn({ data: { tenantId } }),
    onSuccess: (r) => {
      if (r.error) toast.error(r.error);
      else toast.success(`Audit complete — ${r.summary?.total ?? 0} finding${r.summary?.total === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["xero-audit-latest", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Audit failed"),
  });

  const snoozeMut = useMutation({
    mutationFn: (vars: { findingKey: string; days: number | null }) =>
      snoozeFn({ data: { tenantId, findingKey: vars.findingKey, days: vars.days } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xero-audit-latest", tenantId] }),
  });
  const unsnoozeMut = useMutation({
    mutationFn: (findingKey: string) => unsnoozeFn({ data: { tenantId, findingKey } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xero-audit-latest", tenantId] }),
  });

  const run = q.data?.run;
  const findings: any[] = q.data?.findings ?? [];
  const snoozes: Record<string, { until: string | null; note: string | null }> = q.data?.snoozes ?? {};

  const visible = useMemo(() => {
    const now = Date.now();
    return findings
      .filter((f) => {
        const s = snoozes[f.finding_key];
        const isSnoozed = s && (s.until === null || new Date(s.until).getTime() > now);
        if (!showSnoozed && isSnoozed) return false;
        if (catFilter !== "all" && f.category !== catFilter) return false;
        if (sevFilter !== "all" && f.severity !== sevFilter) return false;
        return true;
      })
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  }, [findings, snoozes, catFilter, sevFilter, showSnoozed]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clients/$clientId" params={{ clientId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
        <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
          {runMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : run ? <RefreshCw className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {run ? "Re-run audit" : "Run audit"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xero file audit</CardTitle>
          {run ? (
            <p className="text-xs text-muted-foreground">
              Last run {new Date(run.run_at).toLocaleString()} · {findings.length} finding{findings.length === 1 ? "" : "s"} · {visible.length} shown
              {run.error ? <span className="ml-2 text-destructive">· {run.error}</span> : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No audit has been run yet.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CAT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sevFilter} onValueChange={setSevFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant={showSnoozed ? "secondary" : "ghost"} onClick={() => setShowSnoozed((v) => !v)}>
              {showSnoozed ? "Hide snoozed" : "Show snoozed"}
            </Button>
          </div>

          {visible.length === 0 ? (
            <p className="rounded border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {run ? "No findings match the current filters." : "Run the audit to see findings."}
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((f) => {
                const s = snoozes[f.finding_key];
                const isSnoozed = s && (s.until === null || new Date(s.until).getTime() > Date.now());
                return (
                  <li key={f.id} className="py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <SeverityBadge severity={f.severity} />
                      <Badge variant="outline" className="text-muted-foreground">{CAT_LABEL[f.category] ?? f.category}</Badge>
                      <h3 className="font-medium">{f.title}</h3>
                      <div className="ml-auto flex items-center gap-1">
                        {f.deep_link ? (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={f.deep_link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" /> Open in Xero
                            </a>
                          </Button>
                        ) : null}
                        {isSnoozed ? (
                          <Button size="sm" variant="ghost" onClick={() => unsnoozeMut.mutate(f.finding_key)}>
                            <Bell className="mr-1 h-3 w-3" /> Unsnooze
                          </Button>
                        ) : (
                          <SnoozeMenu onPick={(days) => snoozeMut.mutate({ findingKey: f.finding_key, days })} />
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.message}</p>
                    {isSnoozed && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Snoozed {s.until ? `until ${new Date(s.until).toLocaleDateString()}` : "indefinitely"}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    high: "border-destructive/40 text-destructive",
    medium: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    low: "border-muted-foreground/30 text-muted-foreground",
  };
  return <Badge variant="outline" className={map[severity] ?? ""}>{severity}</Badge>;
}

function SnoozeMenu({ onPick }: { onPick: (days: number | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        <BellOff className="mr-1 h-3 w-3" /> Snooze
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-popover shadow-md">
          {[
            { label: "7 days", days: 7 as number | null },
            { label: "30 days", days: 30 },
            { label: "90 days", days: 90 },
            { label: "Indefinitely", days: null },
          ].map((o) => (
            <button
              key={o.label}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => { onPick(o.days); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
