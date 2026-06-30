import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, AlertCircle, Loader2, Play, RefreshCw } from "lucide-react";
import { getLatestAudit, runXeroAudit } from "@/lib/xero/audit.functions";
import { toast } from "sonner";

type Props = { tenantId: string; tenantName: string; clientId: string };

export function AuditSummaryCard({ tenantId, tenantName, clientId }: Props) {
  const qc = useQueryClient();
  const fetchLatest = useServerFn(getLatestAudit);
  const runFn = useServerFn(runXeroAudit);

  const q = useQuery({
    queryKey: ["xero-audit-latest", tenantId],
    queryFn: () => fetchLatest({ data: { tenantId } }),
    enabled: !!tenantId,
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

  const run = q.data?.run;
  const summary = run?.summary as { total?: number; severity?: { high: number; medium: number; low: number } } | undefined;
  const total = summary?.total ?? 0;
  const sev = summary?.severity ?? { high: 0, medium: 0, low: 0 };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> File audit — {tenantName}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
            {runMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : run ? <RefreshCw className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
            {run ? "Re-run" : "Run audit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !run ? (
          <p className="text-sm text-muted-foreground">No audit has been run yet. Click <strong>Run audit</strong> to scan this Xero file.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                <AlertCircle className="mr-1 h-3 w-3" /> {sev.high} high
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mr-1 h-3 w-3" /> {sev.medium} medium
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {sev.low} low
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                Last run {new Date(run.run_at).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {total === 0 ? "No issues found." : `${total} finding${total === 1 ? "" : "s"} across chart of accounts, bank, AR/AP, and tax.`}
            </p>
            <Button size="sm" variant="ghost" asChild className="-ml-2">
              <Link to="/clients/$clientId/audit/$tenantId" params={{ clientId, tenantId }}>
                Open full report →
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
