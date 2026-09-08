import type { SnapshotSource } from "@/lib/xero/snapshot-source";
import { reconIsOlderThanNightlyCycle } from "@/components/dashboard/ReconAgeNotice";

/**
 * Turn a saved reconciliation's metadata into the same provenance every other
 * converted card reports, so the reconciliation cards render through the ONE
 * freshness component rather than inventing a third style.
 *
 * A saved reconciliation is kept indefinitely for its date, so `stale` is the
 * existing nightly-cycle rule — the same rule <ReconAgeNotice /> already uses.
 * Presentation only: nothing here reads, computes or alters a figure.
 */
export function reconSource(
  meta:
    | { generatedAt: string | null; fromSnapshot: boolean; complete?: boolean }
    | null
    | undefined,
  periodTo?: string | null,
): SnapshotSource | null {
  if (!meta) return null;
  const stored = !!meta.fromSnapshot;
  return {
    mode: stored ? "snapshot" : "live",
    asAt: stored ? (periodTo ?? null) : null,
    fetchedAt: meta.generatedAt,
    stale: stored && reconIsOlderThanNightlyCycle(meta.generatedAt),
    complete: meta.complete !== false,
    connection: "unknown",
  };
}
