// Stage 3 worker: populates public.xero_snapshots.
//
// NOTHING READS THESE SNAPSHOTS YET. This module only writes. No widget, query
// key or displayed figure depends on it — every figure on screen still comes
// from the same live Xero call it came from before.
//
// Invariants (section 0): tokens never leave the server (5); the tenant list is
// derived server-side from `client_xero_orgs` / `xero_connections`, never from
// a caller (4); entitlement is untouched because nothing reads the rows (3, 8).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sydneyDate } from "@/lib/sydney-time";
import {
  INVOICE_PAGE_LIMIT,
  MAX_XERO_CALLS_PER_RUN,
  SNAPSHOT_PAYLOAD_VERSION,
  snapshotParamsHash,
  snapshotReports,
  type SnapshotReport,
} from "./snapshot-keys";

/** Aborts the run when the hard per-run Xero call ceiling is reached. */
export class SnapshotCallCeilingError extends Error {
  constructor(limit: number) {
    super(`Snapshot run aborted: reached the per-run ceiling of ${limit} Xero calls.`);
    this.name = "SnapshotCallCeilingError";
  }
}

export type RefreshTarget = {
  clientId: string;
  firmId: string;
  tenantId: string;
};

export type TenantRefreshResult = {
  tenantId: string;
  runId: string | null;
  status: "complete" | "partial" | "failed" | "skipped";
  succeeded: number;
  failed: number;
  calls: number;
  reason?: string;
};

/**
 * Every tenant with a live connection that is linked to a client.
 * Ordered by a stable hash of the tenant id so the same organisation is not
 * always processed first.
 */
/**
 * Resolve one tenant to its client and organisation, server-side.
 * The caller's authorisation is checked before this is reached; this only
 * turns an already-authorised tenant id into the ids the writer needs.
 */
export async function resolveRefreshTarget(tenantId: string): Promise<RefreshTarget | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("client_id, clients!inner(firm_id), xero_connections!inner(tenant_id, status)")
    .eq("xero_connections.tenant_id", tenantId)
    .eq("xero_connections.status", "connected")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const firmId = data?.clients?.firm_id as string | undefined;
  if (!data?.client_id || !firmId) return null;
  return { clientId: data.client_id as string, firmId, tenantId };
}

export async function listRefreshTargets(): Promise<RefreshTarget[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("client_id, clients!inner(firm_id), xero_connections!inner(tenant_id, status)")
    .eq("xero_connections.status", "connected");
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const targets: RefreshTarget[] = [];
  for (const row of (data ?? []) as any[]) {
    const tenantId = row.xero_connections?.tenant_id;
    const firmId = row.clients?.firm_id;
    if (!tenantId || !firmId) continue;
    const key = `${row.client_id}:${tenantId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ clientId: row.client_id, firmId, tenantId });
  }

  // Stable, non-alphabetical order: staggers which tenant goes first.
  return targets.sort((a, b) => stableHash(a.tenantId) - stableHash(b.tenantId));
}

function stableHash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Counts every Xero call the run issues and enforces the hard ceiling. */
class CallBudget {
  used = 0;
  constructor(private readonly limit: number) {}
  spend() {
    this.used += 1;
    if (this.used > this.limit) throw new SnapshotCallCeilingError(this.limit);
  }
}

/**
 * Global in-process gate. Xero allows 5 concurrent calls app-wide; the worker
 * never uses more than 2 of them, leaving 3 for interactive traffic.
 */
const MAX_INFLIGHT = 2;
let inflight = 0;
const waiters: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inflight >= MAX_INFLIGHT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inflight += 1;
  try {
    return await fn();
  } finally {
    inflight -= 1;
    waiters.shift()?.();
  }
}

const XERO_PAGE_SIZE = 100;

/**
 * `truncated` means the pull hit INVOICE_PAGE_LIMIT while the last page was
 * still full, so there are open invoices we did not fetch. It is NOT a
 * failure — the call succeeded — but the payload is not the whole picture, and
 * a client with more open invoices than the cap is exactly the client this
 * product exists to catch. It must never be stored as complete.
 */
async function fetchReport(
  conn: any,
  report: SnapshotReport,
  budget: CallBudget,
): Promise<{ payload: unknown; truncated: boolean }> {
  const { xeroGet } = await import("./api.server");

  if (!report.paginated) {
    budget.spend();
    const payload = await withSlot(() => xeroGet<unknown>(conn, report.path, report.params));
    return { payload, truncated: false };
  }

  const items: any[] = [];
  let truncated = false;
  for (let page = 1; page <= INVOICE_PAGE_LIMIT; page++) {
    budget.spend();
    const res = await withSlot(() =>
      xeroGet<{ Invoices?: any[] }>(conn, report.path, { ...report.params, page: String(page) }),
    );
    const batch = res?.Invoices ?? [];
    items.push(...batch);
    if (batch.length < XERO_PAGE_SIZE) break;
    // Last allowed page came back full: there is more we are not fetching.
    if (page === INVOICE_PAGE_LIMIT) truncated = true;
  }
  return { payload: { Invoices: items }, truncated };
}

async function writeSnapshot(opts: {
  target: RefreshTarget;
  report: SnapshotReport;
  payload: unknown;
  runId: string;
  fetchedAt: string;
  complete: boolean;
}) {
  const { target, report, payload, runId, fetchedAt, complete } = opts;
  const paramsHash = snapshotParamsHash(report.params);

  // The `fetched_at` guard stops a slow response from an earlier tick
  // overwriting a newer row: `fetched_at` is stamped when Xero responded, not
  // when the insert runs, so a straggler is dropped rather than winning.
  const { error } = await (supabaseAdmin as any).rpc("upsert_xero_snapshot", {
    _client_id: target.clientId,
    _firm_id: target.firmId,
    _tenant_id: target.tenantId,
    _report_key: report.reportKey,
    _params_hash: paramsHash,
    _params: report.params,
    _source_endpoint: report.path,
    _payload: payload as any,
    _payload_version: SNAPSHOT_PAYLOAD_VERSION,
    // Sydney start-of-day, offset resolved per date — never hardcoded.
    _as_at: sydneyStartOfDayISO(report.asAt),
    _fetched_at: fetchedAt,
    _run_id: runId,
    _complete: complete,
  });
  if (error) throw new Error(`snapshot write failed (${report.reportKey}): ${error.message}`);
}

/**
 * Refresh one tenant. Sequential by report; a failed report writes nothing and
 * leaves the previous good row exactly as it was.
 */
export async function refreshTenant(
  target: RefreshTarget,
  trigger: "scheduled" | "manual" | "backfill",
  budget: CallBudget = new CallBudget(MAX_XERO_CALLS_PER_RUN),
): Promise<TenantRefreshResult> {
  const { data: runId, error: claimError } = await (supabaseAdmin as any).rpc(
    "claim_xero_snapshot_run",
    {
      _client_id: target.clientId,
      _firm_id: target.firmId,
      _tenant_id: target.tenantId,
      _trigger: trigger,
    },
  );
  if (claimError) throw new Error(claimError.message);
  if (!runId) {
    return {
      tenantId: target.tenantId,
      runId: null,
      status: "skipped",
      succeeded: 0,
      failed: 0,
      calls: 0,
      reason: "already_running",
    };
  }

  const startedCalls = budget.used;
  const startedAt = Date.now();
  // Sydney, not UTC: at 3am Sydney the UTC date is still yesterday.
  const reports = snapshotReports(sydneyDate());
  let succeeded = 0;
  let failed = 0;
  let fatal: string | null = null;
  let ceiling: SnapshotCallCeilingError | null = null;
  const errors: string[] = [];
  const truncatedReports: string[] = [];

  try {
    const { getConnectionByTenant } = await import("./api.server");
    const conn = await getConnectionByTenant(target.tenantId);

    for (const report of reports) {
      try {
        const { payload, truncated } = await fetchReport(conn, report, budget);
        await writeSnapshot({
          target,
          report,
          payload,
          runId,
          fetchedAt: new Date().toISOString(),
          // Truncated pulls are stored as incomplete, never as whole.
          complete: !truncated,
        });
        if (truncated) truncatedReports.push(report.reportKey);
        succeeded += 1;
      } catch (e) {
        if (e instanceof SnapshotCallCeilingError) throw e;
        failed += 1;
        // Never log tokens: message only, truncated.
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`${report.reportKey}: ${message.slice(0, 160)}`);
      }
    }
  } catch (e) {
    if (e instanceof SnapshotCallCeilingError) ceiling = e;
    fatal = e instanceof Error ? e.message : String(e);
  }

  // Truncation is not a failure, so it does not affect the run status: the
  // report succeeded, it is just incomplete. It is recorded in the summary
  // text and on the snapshot row's `complete` flag.
  const notes: string[] = [...errors];
  if (truncatedReports.length) {
    notes.push(
      `truncated (page cap reached, more records exist): ${truncatedReports.join(", ")}`,
    );
  }

  const status: TenantRefreshResult["status"] = fatal
    ? "failed"
    : failed === 0
      ? "complete"
      : succeeded === 0
        ? "failed"
        : "partial";

  await (supabaseAdmin as any)
    .from("xero_snapshot_runs")
    .update({
      status,
      reports_requested: reports.length,
      reports_succeeded: succeeded,
      reports_failed: failed,
      error: fatal ?? (notes.length ? notes.join(" | ").slice(0, 1000) : null),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    })
    .eq("id", runId);

  // The run row is closed out first, then the ceiling aborts the whole job.
  if (ceiling) throw ceiling;

  const result: TenantRefreshResult = {
    tenantId: target.tenantId,
    runId,
    status,
    succeeded,
    failed,
    calls: budget.used - startedCalls,
  };
  if (fatal) result.reason = fatal.slice(0, 200);
  return result;
}

/**
 * The scheduled run: every connected tenant, sequentially, under one shared
 * call budget so the ceiling bounds the whole run rather than each tenant.
 */
export async function refreshAllTenants(): Promise<{
  ranAt: string;
  sydneyDate: string;
  tenants: number;
  calls: number;
  aborted: boolean;
  results: TenantRefreshResult[];
}> {
  // Sweep abandoned runs before claiming anything (Stage 2's prune function).
  try {
    await (supabaseAdmin as any).rpc("prune_xero_snapshot_runs", {});
  } catch (e) {
    console.warn("[snapshot] prune failed", e instanceof Error ? e.message : e);
  }

  const budget = new CallBudget(MAX_XERO_CALLS_PER_RUN);
  const targets = await listRefreshTargets();
  const results: TenantRefreshResult[] = [];
  let aborted = false;

  for (const target of targets) {
    try {
      results.push(await refreshTenant(target, "scheduled", budget));
    } catch (e) {
      if (e instanceof SnapshotCallCeilingError) {
        aborted = true;
        console.error(`[snapshot] ${e.message}`);
        break;
      }
      results.push({
        tenantId: target.tenantId,
        runId: null,
        status: "failed",
        succeeded: 0,
        failed: 0,
        calls: 0,
        reason: e instanceof Error ? e.message.slice(0, 200) : String(e),
      });
    }
  }

  return {
    ranAt: new Date().toISOString(),
    sydneyDate: sydneyDate(),
    tenants: results.length,
    calls: budget.used,
    aborted,
    results,
  };
}
