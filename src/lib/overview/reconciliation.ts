// Bank-reconciliation staleness, shared by the feed (server) and the overview
// table (browser). Pure: no server-only imports, so it is safe in both bundles.

import { addDays } from "@/lib/sydney-time";
import { BANK_NOT_RECONCILED } from "./thresholds";

/**
 * Bank-not-reconciled rule: the newest reconciled bank transaction is at least
 * BANK_NOT_RECONCILED.staleDays before the data anchor, or there is none at all.
 */
export function bankReconciledStale(reconciledTo: string | null, anchor: string): boolean {
  if (reconciledTo === null) return true;
  return reconciledTo <= addDays(anchor.slice(0, 10), -BANK_NOT_RECONCILED.staleDays);
}
