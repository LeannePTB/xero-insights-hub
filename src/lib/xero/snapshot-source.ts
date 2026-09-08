// Stage 5 provenance. Client-safe: no server imports, no secrets.
//
// Every converted server function returns one of these alongside its figures,
// and every converted widget renders it through <DataSourceLine />. A figure
// with no provenance is a bug — the user must always be able to see which
// period the numbers describe and when they were retrieved.

/**
 * `pending` means the daily refresh has not stored this report for this tenant
 * yet. It is NOT an error and NOT zero: the widget renders "Figures are being
 * prepared" and offers the refresh control. Opening a dashboard must never
 * trigger a Xero run implicitly, so a pending read costs zero Xero calls.
 */
export type SnapshotSourceMode = "snapshot" | "live" | "pending";

export type SnapshotSourceReason =
  /** The selected range is not the stored one — live, by design. */
  | "range"
  /** Reporting basis differs from the snapshot's basis — live, by design. */
  | "basis"
  /** No stored row for this key/params. */
  | "missing"
  /** Stored row is an older payload version. */
  | "version"
  /** Rolled back to live via XERO_SNAPSHOT_LIVE_KEYS. */
  | "disabled";

export type SnapshotSource = {
  mode: SnapshotSourceMode;
  /** The calendar date the figures describe (Sydney), or null when live. */
  asAt: string | null;
  /** When the figures were retrieved from Xero. */
  fetchedAt: string | null;
  /** Older than STALENESS_SECONDS for this report key. */
  stale: boolean;
  /** False when the pull was truncated — totals may be understated. */
  complete: boolean;
  /** Xero connection state at read time. */
  connection: "connected" | "disconnected" | "unknown";
  reason?: SnapshotSourceReason;
  /** True when the figures are part stored and part live (see `mergeSources`). */
  mixed?: boolean;
};

/** The provenance of a value fetched live from Xero just now. */
export function liveSource(
  reason: SnapshotSourceReason,
  connection: SnapshotSource["connection"] = "connected",
): SnapshotSource {
  return {
    mode: "live",
    asAt: null,
    fetchedAt: new Date().toISOString(),
    stale: false,
    complete: true,
    connection,
    reason,
  };
}

/** No stored figures yet for this tenant and report key. */
export function pendingSource(connection: SnapshotSource["connection"] = "unknown"): SnapshotSource {
  return {
    mode: "pending",
    asAt: null,
    fetchedAt: null,
    stale: false,
    complete: true,
    connection,
    reason: "missing",
  };
}

/**
 * Combine the provenance of every component a card is made of.
 *
 * A card that blends a live call with a stored copy is only as fresh as its
 * OLDEST component, so that is what this reports: the earliest `fetchedAt`,
 * `mode: "snapshot"` if any part was stored, `mixed` when it is part stored and
 * part live, stale if any part is stale, complete only if every part is.
 * Overstating freshness is the fault this exists to prevent.
 */
export function mergeSources(parts: (SnapshotSource | null | undefined)[]): SnapshotSource | null {
  const list = parts.filter(Boolean) as SnapshotSource[];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0]!;

  const stored = list.filter((s) => s.mode === "snapshot");
  const live = list.filter((s) => s.mode === "live");
  const pending = list.some((s) => s.mode === "pending");

  const times = list.map((s) => (s.fetchedAt ? new Date(s.fetchedAt).getTime() : NaN)).filter((t) => !isNaN(t));
  const oldest = times.length ? new Date(Math.min(...times)).toISOString() : null;

  const asAts = stored.map((s) => s.asAt).filter(Boolean) as string[];
  asAts.sort();

  return {
    mode: pending && stored.length === 0 && live.length === 0 ? "pending" : stored.length > 0 ? "snapshot" : "live",
    asAt: asAts[0] ?? null,
    fetchedAt: oldest,
    stale: list.some((s) => s.stale),
    complete: list.every((s) => s.complete),
    connection: list.some((s) => s.connection === "disconnected")
      ? "disconnected"
      : list.every((s) => s.connection === "connected")
        ? "connected"
        : "unknown",
    mixed: stored.length > 0 && live.length > 0,
  };
}
