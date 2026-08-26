// Stage 5 provenance. Client-safe: no server imports, no secrets.
//
// Every converted server function returns one of these alongside its figures,
// and every converted widget renders it through <DataSourceLine />. A figure
// with no provenance is a bug — the user must always be able to see which
// period the numbers describe and when they were retrieved.

export type SnapshotSourceMode = "snapshot" | "live";

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
