// Every tunable number the client overview uses, in one place, in the style of
// `src/lib/health/rule-thresholds.ts`. Staff-only.

export const BIG_MOVE = {
  /** Relative: |change| / |before| must be at least this. */
  minRelativeChange: 0.25,
  /** Material: |change| must be at least max(this, share × average monthly revenue). */
  minAbsoluteChange: 10_000,
  revenueShareFloor: 0.1,
  /**
   * Unusual: the same window ending at the same point last month is a routine
   * explanation when it moved the same way by at least this share of today's move.
   */
  routineShareOfMove: 0.5,
  /** Windows checked, in days. */
  windowsDays: [1, 7] as const,
} as const;

export const REPORT_NOT_SENT = {
  /** No sent report for the previous month by this business day of the current month. */
  businessDay: 15,
} as const;

export const FEED = {
  /** The "What changed" feed looks back this many days. */
  lookbackDays: 7,
} as const;

export const BANK_NOT_RECONCILED = {
  /** A connected file whose newest reconciled bank transaction is at least this old is flagged. */
  staleDays: 14,
} as const;
