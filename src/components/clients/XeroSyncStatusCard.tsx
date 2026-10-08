import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { getClientXeroSyncStatus, type XeroSyncStatusFile } from "@/lib/xero/sync-status.functions";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function FileStatus({ f }: { f: XeroSyncStatusFile }) {
  const disconnected = f.connectionStatus === "disconnected";
  const failed = f.lastRunStatus === "Failed";
  const ok = !disconnected && !failed && f.recentErrors.length === 0;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{f.tenantName}</span>
        {ok ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Syncing normally
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" /> Needs attention
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Connection</dt>
        <dd>{disconnected ? "Disconnected" : "Connected"}</dd>
        <dt className="text-muted-foreground">Last refresh</dt>
        <dd>
          {fmt(f.lastRunAt)}
          {f.lastRunStatus ? ` — ${f.lastRunStatus}` : ""}
        </dd>
        <dt className="text-muted-foreground">Last successful refresh</dt>
        <dd>{fmt(f.lastSuccessAt)}</dd>
      </dl>

      {disconnected && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This file was disconnected{f.disconnectedReason ? `: ${f.disconnectedReason}` : ""}. Use
          “Reconnect to Xero” below to restore it.
        </p>
      )}
      {f.lastRunError && (
        <p className="text-xs text-muted-foreground">Last refresh error: {f.lastRunError}</p>
      )}

      {f.recentErrors.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Recent Xero errors (last 7 days)</p>
          <ul className="space-y-1">
            {f.recentErrors.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="text-foreground">{e.reason}</span>
                {e.httpStatus !== null && ` (${e.httpStatus})`} — {e.path},{` `}
                {e.occurrences}× , last {fmt(e.lastSeen)}
                {e.detail && <span className="block italic">{e.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Xero certification checkpoint 5: the customer can see, per connected Xero
 * file, whether syncs are working and why they failed. Reads come through the
 * caller's own session; the database policies decide visibility.
 */
export function XeroSyncStatusCard({ clientId }: { clientId: string }) {
  const fetchStatus = useServerFn(getClientXeroSyncStatus);
  const q = useQuery({
    queryKey: ["client-xero-sync-status", clientId],
    queryFn: () => fetchStatus({ data: { clientId } }),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2Icon /> Checking Xero sync status…
      </div>
    );
  }
  if (q.isError || !q.data) return null;
  if (q.data.files.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Xero sync status</h3>
      </div>
      {q.data.files.map((f) => (
        <FileStatus key={f.tenantId} f={f} />
      ))}
    </div>
  );
}

function Loader2Icon() {
  return <RefreshCw className="h-4 w-4 animate-spin" />;
}
