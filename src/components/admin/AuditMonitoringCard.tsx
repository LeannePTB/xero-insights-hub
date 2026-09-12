import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import {
  exportAuditLogCsv,
  getAuditAnomalies,
  getRetentionStatus,
  type AuditExportCategory,
} from "@/lib/audit.functions";

function StatusPill({ status }: { status: "ok" | "warn" | "action" }) {
  if (status === "ok") return <Badge className="bg-green-600 hover:bg-green-600 text-white">OK</Badge>;
  if (status === "warn") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Watch</Badge>;
  return <Badge variant="destructive">Investigate</Badge>;
}

const EXPORT_RANGES = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
];

const EXPORT_CATEGORIES: { value: AuditExportCategory; label: string; hint: string }[] = [
  {
    value: "security",
    label: "Security events",
    hint: "Sign-ins, permission changes, Xero connection and token events. Leaves out the high-volume reads.",
  },
  {
    value: "reads",
    label: "Client data reads",
    hint: "Who opened which client's figures, when and from where. No figures are ever recorded, only the fact of the read.",
  },
  { value: "all", label: "Everything", hint: "Both lists in one file." },
];

export function AuditMonitoringCard() {
  const anomaliesFn = useServerFn(getAuditAnomalies);
  const retentionFn = useServerFn(getRetentionStatus);
  const exportFn = useServerFn(exportAuditLogCsv);
  const [exporting, setExporting] = useState<number | null>(null);
  const [category, setCategory] = useState<AuditExportCategory>("security");

  const anomaliesQ = useQuery({
    queryKey: ["audit-anomalies"],
    queryFn: () => anomaliesFn(),
    refetchInterval: 5 * 60 * 1000,
  });
  const retentionQ = useQuery({
    queryKey: ["audit-retention-status"],
    queryFn: () => retentionFn(),
  });

  async function handleExport(days: number) {
    setExporting(days);
    try {
      const res = await exportFn({ data: { days, category } });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.rows} audit row(s).`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  const r = retentionQ.data;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Audit trail &amp; monitoring</h2>
          <p className="text-sm text-muted-foreground">
            Sign-ins, permission changes, Xero token events and accounting-data reads are recorded
            with actor, IP and device, then retained and purged on a fixed schedule.
          </p>
        </div>

        {anomaliesQ.isLoading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading the trail…
          </div>
        ) : anomaliesQ.error ? (
          <p className="text-sm text-destructive">{(anomaliesQ.error as Error).message}</p>
        ) : (
          <div className="divide-y">
            {(anomaliesQ.data?.anomalies ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                <div className="min-w-0">
                  <div className="font-medium">
                    {a.title} — <span className="tabular-nums">{a.count}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{a.detail}</div>
                </div>
                <div className="shrink-0">
                  <StatusPill status={a.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="font-medium">Retention</div>
          {r ? (
            <p className="text-muted-foreground">
              Audit log kept {Math.round(r.auditRetentionDays / 365 * 10) / 10} year(s), sign-in
              history {Math.round(r.loginRetentionDays / 365 * 10) / 10} year(s). Automatic nightly
              purge{" "}
              {r.lastPurgeAt
                ? `last removed expired rows on ${new Date(r.lastPurgeAt).toLocaleString()}.`
                : "has not needed to remove anything yet."}{" "}
              {r.staleAuditRows + r.staleLoginRows > 0
                ? `${r.staleAuditRows + r.staleLoginRows} row(s) are past retention and will clear on the next run.`
                : "Nothing is currently past retention."}
            </p>
          ) : (
            <p className="text-muted-foreground">Loading retention settings…</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Export for auditors:</span>
            {EXPORT_CATEGORIES.map((c) => (
              <Button
                key={c.value}
                variant={category === c.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(c.value)}
                disabled={exporting !== null}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {EXPORT_CATEGORIES.find((c) => c.value === category)?.hint}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {EXPORT_RANGES.map((range) => (
              <Button
                key={range.days}
                variant="outline"
                size="sm"
                onClick={() => handleExport(range.days)}
                disabled={exporting !== null}
              >
                {exporting === range.days ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
