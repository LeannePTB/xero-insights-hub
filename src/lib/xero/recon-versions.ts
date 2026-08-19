// Snapshot payload versions, one per reconciliation report key.
//
// `reconciliation_snapshots` never recomputes a complete snapshot so period-end
// figures cannot drift. That is only safe while the calculation is unchanged —
// so every payload carries `version`, and a stored snapshot written by an older
// version is superseded (recomputed and replaced) on the next read.
//
// BUMP THE NUMBER whenever the shape or the calculation of a report changes.

export const RECON_VERSIONS: Record<string, number> = {
  // v2: extended from four accounts to every balance sheet account.
  balance_sheet_reconciliation: 2,
  // v2: draft assets reported separately from an empty register.
  fixed_assets_reconciliation: 2,
  gst_reconciliation: 1,
  loan_consolidation: 1,
};

export function reconVersion(reportKey: string): number {
  return RECON_VERSIONS[reportKey] ?? 1;
}
