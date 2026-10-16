// Every tunable number the verdict rules use, in one place.
//
// These live in code, not in a table, deliberately: there are three rules and
// no tuning history yet, so a table would buy a schema, an RLS policy, an
// editor and a cache-invalidation story before we know which numbers actually
// move. One exported object per rule keeps a later lift into a table a read
// swap rather than a rewrite.

// The tax and debtor thresholds themselves (7 days, 14 days, 90 days, $2,000,
// 20% / 50%) live in `health-checks.ts`, shared with the Business Health card.
// Only the ranking weights live here.

/** R01 — tax set aside (R05 statutory magnitude merged in, 16 Oct 2026). */
export const TAX_RULE = {
  consequence: { action: 90, warn: 70 },
} as const;

/** R06 — customers paying recent invoices on time. */
export const DEBTOR_RULE = {
  /** Share of recent invoices owed by a single customer (Watch only). */
  watchConcentrationShare: 0.5,
  consequence: { action: 85, warn: 65, watch: 40 },
} as const;

/** Report keys a client must have before any verdict is produced. */
export const REQUIRED_REPORT_KEYS = ["balance_sheet", "accounts", "invoices_accrec_open"] as const;

/**
 * Report keys a verdict READS. Wider than the required set: the payables list
 * is optional (a verdict is still produced without it) but the lodged-and-owing
 * half of protected money is refused when it is absent, so it must be loaded.
 * Leaving it out of the query made every client report "1 check unavailable"
 * while the snapshot sat in the table, complete.
 */
export const VERDICT_REPORT_KEYS = [
  ...REQUIRED_REPORT_KEYS,
  "invoices_accpay_open",
] as const;
