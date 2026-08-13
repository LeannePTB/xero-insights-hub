import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLatestAudit, runXeroAudit, snoozeFinding, unsnoozeFinding, resolveFinding } from "@/lib/xero/audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Loader2, ExternalLink, BellOff, Bell, Play, Check, Undo2 } from "lucide-react";
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
  const resolveFn = useServerFn(resolveFinding);

  const [catFilter, setCatFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  const resolveMut = useMutation({
    mutationFn: (vars: { findingKey: string; resolved: boolean }) =>
      resolveFn({ data: { tenantId, findingKey: vars.findingKey, resolved: vars.resolved } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.resolved ? "Marked as resolved" : "Reopened");
      qc.invalidateQueries({ queryKey: ["xero-audit-latest", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update finding"),
  });

  const run = q.data?.run;
  const findings: any[] = q.data?.findings ?? [];
  const snoozes: Record<string, { until: string | null; note: string | null; resolved?: boolean; resolvedAt?: string | null }> =
    (q.data?.snoozes as any) ?? {};

  const visible = useMemo(() => {
    const now = Date.now();
    return findings
      .filter((f) => {
        const s = snoozes[f.finding_key];
        const isResolved = !!s?.resolved;
        const isSnoozed = !isResolved && s && (s.until === null || new Date(s.until).getTime() > now);
        if (!showResolved && isResolved) return false;
        if (!showSnoozed && isSnoozed) return false;
        if (catFilter !== "all" && f.category !== catFilter) return false;
        if (sevFilter !== "all" && f.severity !== sevFilter) return false;
        return true;
      })
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  }, [findings, snoozes, catFilter, sevFilter, showSnoozed, showResolved]);

  const selectableKeys = useMemo(() => {
    const now = Date.now();
    return visible
      .filter((f) => {
        const s = snoozes[f.finding_key];
        if (s?.resolved) return false;
        return !(s && (s.until === null || new Date(s.until).getTime() > now));
      })
      .map((f) => f.finding_key as string);
  }, [visible, snoozes]);

  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        selectableKeys.forEach((k) => next.delete(k));
        return next;
      }
      const next = new Set(prev);
      selectableKeys.forEach((k) => next.add(k));
      return next;
    });
  };
  const toggleOne = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const bulkSnoozeMut = useMutation({
    mutationFn: async (days: number | null) => {
      const keys = Array.from(selected);
      for (const k of keys) {
        await snoozeFn({ data: { tenantId, findingKey: k, days } });
      }
      return keys.length;
    },
    onSuccess: (count) => {
      toast.success(`Snoozed ${count} finding${count === 1 ? "" : "s"}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["xero-audit-latest", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk snooze failed"),
  });

  const bulkResolveMut = useMutation({
    mutationFn: async () => {
      const keys = Array.from(selected);
      for (const k of keys) {
        await resolveFn({ data: { tenantId, findingKey: k, resolved: true } });
      }
      return keys.length;
    },
    onSuccess: (count) => {
      toast.success(`Resolved ${count} finding${count === 1 ? "" : "s"}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["xero-audit-latest", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk resolve failed"),
  });

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
            <Button size="sm" variant={showResolved ? "secondary" : "ghost"} onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? "Hide resolved" : "Show resolved"}
            </Button>
            {selectableKeys.length > 0 && (
              <label className="ml-2 flex items-center gap-2 text-sm">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                Select all ({selectableKeys.length})
              </label>
            )}
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <Button size="sm" disabled={bulkResolveMut.isPending} onClick={() => bulkResolveMut.mutate()}>
                <Check className="mr-1 h-3 w-3" /> Mark resolved
              </Button>
              <span className="text-muted-foreground">Snooze for:</span>
              {[
                { label: "7 days", days: 7 as number | null },
                { label: "30 days", days: 30 },
                { label: "90 days", days: 90 },
                { label: "Indefinitely", days: null },
              ].map((o) => (
                <Button
                  key={o.label}
                  size="sm"
                  variant="outline"
                  disabled={bulkSnoozeMut.isPending}
                  onClick={() => bulkSnoozeMut.mutate(o.days)}
                >
                  {o.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
                Clear
              </Button>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="rounded border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {run ? "No findings match the current filters." : "Run the audit to see findings."}
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((f) => {
                const s = snoozes[f.finding_key];
                const isResolved = !!s?.resolved;
                const isSnoozed = !isResolved && s && (s.until === null || new Date(s.until).getTime() > Date.now());
                const isSelected = selected.has(f.finding_key);
                return (
                  <li key={f.id} className="py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      {!isSnoozed && !isResolved && (
                        <Checkbox
                          className="mt-1"
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(f.finding_key)}
                          aria-label="Select finding"
                        />
                      )}
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
                        {isResolved ? (
                          <Button size="sm" variant="ghost" onClick={() => resolveMut.mutate({ findingKey: f.finding_key, resolved: false })} disabled={resolveMut.isPending}>
                            <Undo2 className="mr-1 h-3 w-3" /> Reopen
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => resolveMut.mutate({ findingKey: f.finding_key, resolved: true })} disabled={resolveMut.isPending}>
                              <Check className="mr-1 h-3 w-3" /> Resolve
                            </Button>
                            {isSnoozed ? (
                              <Button size="sm" variant="ghost" onClick={() => unsnoozeMut.mutate(f.finding_key)}>
                                <Bell className="mr-1 h-3 w-3" /> Unsnooze
                              </Button>
                            ) : (
                              <SnoozeMenu onPick={(days) => snoozeMut.mutate({ findingKey: f.finding_key, days })} />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.message}</p>
                    <TransactionLinks finding={f} />
                    {isResolved && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resolved{s?.resolvedAt ? ` on ${new Date(s.resolvedAt).toLocaleDateString()}` : ""}
                      </p>
                    )}
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

function TransactionLinks({ finding }: { finding: any }) {
  const ev = finding?.evidence ?? {};
  const ids: string[] = Array.isArray(ev.paymentIds) ? ev.paymentIds : [];
  const dates: string[] = Array.isArray(ev.dates) ? ev.dates : [];
  const base: string | null = finding?.deep_link ?? null;
  const anchorId: string | null = finding?.entity_id ?? null;
  if (ids.length < 2 || !base || !anchorId) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-muted-foreground">Transactions in Xero:</span>
      {ids.map((id, i) => (
        <a
          key={id}
          href={base.split(anchorId).join(id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {dates[i] ?? `Payment ${i + 1}`}
        </a>
      ))}
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
