// Stage 5 read path. The one place a stored snapshot is turned into a figure.
//
// Access: every read goes through `context.supabase`, so the dual-check RLS on
// `xero_snapshots` applies as the caller. `supabaseAdmin` is never used here.
// A tenantId is a FILTER, never a GRANT (invariant 4) — callers still run
// `assertWidgetAccess` before reaching this module.
//
// Fail closed (invariant 8): if a row is absent, unreadable, an older payload
// version, or the parameters do not match exactly, this returns null and the
// caller falls back to its live branch. There is no nearest-snapshot fallback,
// no widening and no snapping of a user's chosen range.

import { SNAPSHOT_PAYLOAD_VERSION, STALENESS_SECONDS, snapshotParamsHash, snapshotReports } from "./snapshot-keys";
import { isSnapshotDisabled } from "./snapshot-flags";
import type { SnapshotSource } from "./snapshot-source";
import { sydneyDate } from "@/lib/sydney-time";

export type SnapshotHit = {
  payload: any;
  source: SnapshotSource;
};

const DEFAULT_STALENESS_SECONDS = 30 * 3600;

/**
 * The parameters the daily writer used for a report key today. Reading them
 * from the same catalogue the writer uses is what guarantees the hash cannot
 * drift between the two sides.
 */
export function catalogueParams(
  reportKey: string,
  today: string = sydneyDate(),
): Record<string, string | undefined> | null {
  const report = snapshotReports(today).find((r) => r.reportKey === reportKey);
  return report ? report.params : null;
}

/** True when the caller's own parameters are byte-for-byte the stored set. */
export function paramsMatchCatalogue(
  reportKey: string,
  params: Record<string, string | undefined>,
  today: string = sydneyDate(),
): boolean {
  const stored = catalogueParams(reportKey, today);
  if (!stored) return false;
  return snapshotParamsHash(stored) === snapshotParamsHash(params);
}

export async function connectionStatus(
  supabase: any,
  tenantId: string,
): Promise<SnapshotSource["connection"]> {
  const { data } = await supabase
    .from("xero_connections")
    .select("status")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  const status = data?.status;
  if (status === "connected") return "connected";
  if (status) return "disconnected";
  return "unknown";
}

/**
 * Look up one stored snapshot.
 *
 * `params` defaults to the catalogue's parameters for the key. Pass explicit
 * params when the caller has a user-adjustable range: a hash mismatch simply
 * returns null, which is the "go live" signal.
 */
export async function readSnapshot(opts: {
  supabase: any;
  tenantId: string;
  clientId?: string | null;
  reportKey: string;
  params?: Record<string, string | undefined>;
  now?: Date;
}): Promise<SnapshotHit | null> {
  const { supabase, tenantId, clientId, reportKey } = opts;
  const now = opts.now ?? new Date();

  if (isSnapshotDisabled(reportKey)) return null;

  const params = opts.params ?? catalogueParams(reportKey);
  if (!params) return null;
  const paramsHash = snapshotParamsHash(params);

  let query = supabase
    .from("xero_snapshots")
    .select("payload, payload_version, as_at, fetched_at, complete")
    .eq("tenant_id", tenantId)
    .eq("report_key", reportKey)
    .eq("params_hash", paramsHash)
    .limit(1);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query.maybeSingle();
  // An error resolving a snapshot is never fatal: fall through to live.
  if (error) {
    console.warn("[snapshot] read failed", { reportKey, message: error.message });
    return null;
  }
  if (!data) return null;
  if (data.payload_version !== SNAPSHOT_PAYLOAD_VERSION) return null;

  const fetchedAt = data.fetched_at as string;
  const ageSeconds = (now.getTime() - new Date(fetchedAt).getTime()) / 1000;
  const threshold = STALENESS_SECONDS[reportKey] ?? DEFAULT_STALENESS_SECONDS;

  return {
    payload: data.payload,
    source: {
      mode: "snapshot",
      // Stored as a Sydney start-of-day timestamptz; the calendar date is what
      // the figures describe.
      asAt: String(data.as_at).slice(0, 10),
      fetchedAt,
      stale: ageSeconds >= threshold,
      complete: data.complete !== false,
      connection: await connectionStatus(supabase, tenantId),
    },
  };
}
