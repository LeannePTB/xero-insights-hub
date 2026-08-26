// Rollback switch for Stage 5, per report key. No deploy required.
//
// XERO_SNAPSHOT_LIVE_KEYS is a comma-separated list of report keys that must
// be served live, ignoring any stored snapshot. `*` reverts the whole of
// Stage 5. Every converted server function keeps its live branch, so flipping
// a key back costs an env var change and a restart — no code edit, no
// migration.
//
// Read inside the function, never at module scope: env injection happens at
// call time.

export function liveOnlyKeys(): Set<string> {
  const raw = process.env["XERO_SNAPSHOT_LIVE_KEYS"] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isSnapshotDisabled(reportKey: string): boolean {
  const keys = liveOnlyKeys();
  return keys.has("*") || keys.has(reportKey);
}
