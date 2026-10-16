// Every tunable number the verdict rules use, in one place.
//
// These live in code, not in a table, deliberately: there are three rules and
// no tuning history yet, so a table would buy a schema, an RLS policy, an
// editor and a cache-invalidation story before we know which numbers actually
// move. One exported object per rule keeps a later lift into a table a read
// swap rather than a rewrite.

export const R01_PROTECTED_MONEY = {
  /** Protected money as a fraction of cash at bank. */
  criticalRatio: 1.0,
  warningRatio: 0.75,
  watchRatio: 0.5,
  consequence: { critical: 90, warning: 70, watch: 45 },
} as const;

export const R05_STATUTORY_MAGNITUDE = {
  /** GST + PAYG withholding + tax balances as a fraction of cash at bank. */
  warningRatio: 0.6,
  watchRatio: 0.35,
  consequence: { warning: 60, watch: 35 },
} as const;

export const R06_DEBTORS = {
  /** Share of the open debtor book more than 90 days past its due date. */
  criticalOver90Share: 0.2,
  /** Share of the open debtor book past its due date at all. */
  warningOverdueShare: 0.4,
  /** Share of the open debtor book owed by a single customer. */
  watchConcentrationShare: 0.5,
  over90Days: 90,
  consequence: { critical: 85, warning: 65, watch: 40 },
  daysToConsequence: { critical: 0, warning: 30, watch: 60 },
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
