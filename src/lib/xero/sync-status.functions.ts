import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Per-client "Xero sync status" for the client settings page (Xero
 * certification checkpoint 5: users must be able to see that an error
 * happened, and why, inside the app).
 *
 * Everything is read through the caller's own session, so the existing RLS
 * policies decide visibility — no new access path, no admin client:
 *  - client_xero_orgs / xero_connections: the client's linked Xero files
 *    (same rows the settings page already loads).
 *  - xero_snapshot_runs: "entitled users read snapshot runs"
 *    (user_can_access_client AND user_can_access_tenant).
 *  - xero_api_errors: "read xero errors for own organisation".
 *
 * Only operational metadata is returned: statuses, times, endpoint paths and
 * Xero's own error message (which the caller's policy already entitles them
 * to). Never tokens, never financial figures.
 */

export type XeroSyncStatusError = {
  path: string;
  httpStatus: number | null;
  occurrences: number;
  lastSeen: string;
  /** Plain-English summary derived from the status code. */
  reason: string;
  /** Xero's own message, truncated. */
  detail: string | null;
};

export type XeroSyncStatusFile = {
  tenantId: string;
  tenantName: string;
  connectionStatus: string;
  disconnectedReason: string | null;
  disconnectedAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  lastSuccessAt: string | null;
  recentErrors: XeroSyncStatusError[];
};

function plainReason(httpStatus: number | null): string {
  switch (httpStatus) {
    case 401:
    case 403:
      return "Xero no longer accepts this connection — reconnect the file.";
    case 404:
      return "Xero could not find what was asked for — the file or report may have changed.";
    case 429:
      return "Xero's rate limit was reached — the next refresh retries automatically.";
    default:
      if (httpStatus !== null && httpStatus >= 500)
        return "Xero had a problem on its side — the next refresh retries automatically.";
      return "Xero returned an error.";
  }
}

function runStatusLabel(status: string | null): string | null {
  if (status === null) return null;
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partially complete";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return status;
  }
}

export const getClientXeroSyncStatus = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ files: XeroSyncStatusFile[] }> => {
    // 1. The client's linked Xero files (RLS: caller must be entitled to the client).
    const { data: links, error: linkErr } = await context.supabase
      .from("client_xero_orgs")
      .select("xero_connection_id, xero_connections(tenant_id, tenant_name, status, disconnected_reason, disconnected_at)")
      .eq("client_id", data.clientId);
    if (linkErr) throw new Error(linkErr.message);

    const files: XeroSyncStatusFile[] = [];
    const tenantIds: string[] = [];
    for (const row of (links ?? []) as any[]) {
      const conn = row.xero_connections;
      if (!conn?.tenant_id) continue;
      tenantIds.push(conn.tenant_id as string);
      files.push({
        tenantId: conn.tenant_id as string,
        tenantName: (conn.tenant_name as string) ?? "Unknown",
        connectionStatus: (conn.status as string) ?? "connected",
        disconnectedReason: (conn.disconnected_reason as string | null) ?? null,
        disconnectedAt: (conn.disconnected_at as string | null) ?? null,
        lastRunAt: null,
        lastRunStatus: null,
        lastRunError: null,
        lastSuccessAt: null,
        recentErrors: [],
      });
    }
    if (files.length === 0) return { files };

    // 2. Recent snapshot runs for these files (RLS: entitled users only).
    const { data: runs, error: runErr } = await context.supabase
      .from("xero_snapshot_runs")
      .select("tenant_id, status, error, started_at, finished_at")
      .eq("client_id", data.clientId)
      .in("tenant_id", tenantIds)
      .order("started_at", { ascending: false })
      .limit(50);
    if (runErr) throw new Error(runErr.message);

    for (const f of files) {
      const mine = ((runs ?? []) as any[]).filter((r) => r.tenant_id === f.tenantId);
      const latest = mine[0];
      if (latest) {
        f.lastRunAt = (latest.finished_at as string | null) ?? (latest.started_at as string);
        f.lastRunStatus = runStatusLabel(latest.status as string);
        f.lastRunError = typeof latest.error === "string" ? latest.error.slice(0, 200) : null;
      }
      const success = mine.find((r) => r.status === "complete" || r.status === "partial");
      if (success) f.lastSuccessAt = (success.finished_at as string | null) ?? (success.started_at as string);
    }

    // 3. Xero API errors for these files in the last 7 days (RLS: own organisation).
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: errs, error: errErr } = await context.supabase
      .from("xero_api_errors")
      .select("tenant_id, path, http_status, occurrences, last_seen, last_message")
      .in("tenant_id", tenantIds)
      .gte("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(50);
    if (errErr) throw new Error(errErr.message);

    for (const f of files) {
      f.recentErrors = ((errs ?? []) as any[])
        .filter((e) => e.tenant_id === f.tenantId)
        .slice(0, 5)
        .map((e) => ({
          path: (e.path as string) ?? "unknown",
          httpStatus: e.http_status == null ? null : Number(e.http_status),
          occurrences: Number(e.occurrences ?? 0),
          lastSeen: e.last_seen as string,
          reason: plainReason(e.http_status == null ? null : Number(e.http_status)),
          detail: typeof e.last_message === "string" ? e.last_message.slice(0, 200) : null,
        }));
    }

    return { files };
  });
