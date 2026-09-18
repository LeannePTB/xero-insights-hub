// Pure reconciliation of a LIVE liability balance against SAVED pay runs.
//
// WHY THIS EXISTS
// The PAYG withholding and superannuation cards show a balance read from Xero
// live, and explain it with a pay-run list that is usually last night's stored
// copy. When a pay run posts after that copy was taken, the balance is larger
// than the saved runs can explain. The old walk kept absorbing older periods
// until it overshot, then reported the oldest period it had reached — which
// invented a liability for a month that was in fact paid.
//
// The rule here: a period is only ever named as owing when it fits INSIDE the
// balance in full. Anything left over is reported as a residue, never pushed
// onto an older period.
//
// No imports: shared by server functions and by tests.

export type ReconcilePeriod = {
  /** Month (first day, ISO) or payday (ISO date). Newest first. */
  key: string;
  amount: number;
};

export type ResidueKind =
  /** The named periods add up to the balance exactly. */
  | "none"
  /** The balance is larger than the pay runs saved up to their own date can
   *  explain, and the balance was read later than those runs were saved: the
   *  difference is withheld/accrued since the last saved pay run. */
  | "since_last_pay_run"
  /** Same vintage on both sides, so the difference is not staleness — a part
   *  payment, a manual journal or an adjustment. No split can be claimed. */
  | "unmatched";

export type Reconciliation = {
  /** Periods fully covered by the balance, newest first. */
  owing: string[];
  /** Oldest fully covered period, or null. Never a period we merely reached. */
  oldest: string | null;
  /** True when the owing periods add up to the balance. */
  matches: boolean;
  /** Total of the owing periods. */
  accountedFor: number;
  /** Balance not accounted for by any named period. Always >= 0. */
  residue: number;
  residueKind: ResidueKind;
};

const TOL = 0.005;
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Match `outstanding` against `periods` (newest first), taking only whole
 * periods that fit. Stops at the first period that would overshoot.
 */
export function reconcileBalanceAgainstPeriods(
  outstanding: number,
  periods: ReconcilePeriod[],
  /** True when the balance was read AFTER the saved pay runs were taken, so a
   *  residue is explained by pay runs posted since. Vintage is the caller's
   *  knowledge, never guessed from the arithmetic. */
  opts: { savedRunsOlderThanBalance?: boolean } = {},
): Reconciliation {
  if (!(outstanding > TOL)) {
    return {
      owing: [],
      oldest: null,
      matches: outstanding >= -TOL && outstanding <= TOL,
      accountedFor: 0,
      residue: 0,
      residueKind: "none",
    };
  }

  const owing: string[] = [];
  let accountedFor = 0;

  for (const p of periods) {
    if (!(p.amount > TOL)) continue;
    if (round(accountedFor + p.amount) <= outstanding + TOL) {
      accountedFor = round(accountedFor + p.amount);
      owing.push(p.key);
      continue;
    }
    // Taking this period would claim more is owing than the balance shows.
    // Stop: never absorb it, and never reach past it to an older one.
    break;
  }

  const residue = round(outstanding - accountedFor);
  const residueKind: ResidueKind =
    residue <= TOL ? "none" : opts.savedRunsOlderThanBalance ? "since_last_pay_run" : "unmatched";

  return {
    owing,
    oldest: owing.length ? owing[owing.length - 1]! : null,
    matches: residue <= TOL && owing.length > 0,
    accountedFor,
    residue: residue <= TOL ? 0 : residue,
    residueKind,
  };
}

/** Whether a saved pay-run list is fit to be combined with a live figure for a
 *  period, and why not when it is not. A BAS estimate must call itself
 *  incomplete when the saved list stops before the period ends OR was a partial
 *  pull — not only when a read failed. */
export function payRunVintageIssues(input: {
  /** The stored copy's own as-at date, or null when read live. */
  payRunsAsAt: string | null;
  /** The stored copy's own completeness flag. Never assume true. */
  payRunsComplete: boolean;
  /** Last day of the period being estimated. */
  periodTo: string;
}): { coversPeriodEnd: boolean; complete: boolean; issues: string[] } {
  const { payRunsAsAt, payRunsComplete, periodTo } = input;
  const coversPeriodEnd = !payRunsAsAt || payRunsAsAt >= periodTo;
  const issues: string[] = [];
  if (!coversPeriodEnd) {
    issues.push(
      `Pay runs are only saved as at ${payRunsAsAt}, which is before this period ends on ${periodTo}. Any pay run paid after that date is not in the PAYG figure.`,
    );
  }
  if (!payRunsComplete) {
    issues.push(
      "The saved pay-run list was a partial pull (it stops at the read limit), so an older pay run inside this period may be missing from the PAYG figure.",
    );
  }
  return { coversPeriodEnd, complete: issues.length === 0, issues };
}
