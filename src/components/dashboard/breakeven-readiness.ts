/**
 * Readiness gate for every card that intersects Xero figures with stored cost
 * classifications.
 *
 * The break-even card used to render as soon as the profit-and-loss request
 * finished, while the separate classification and account requests were still in
 * flight. An in-flight classification list reads as an empty list, so every
 * cost-of-sales account seeded as variable and the card showed a confident,
 * wrong fixed-cost figure. Nothing may be calculated until all three inputs have
 * either resolved or failed, and a failure must be said out loud rather than
 * silently falling back to defaults.
 *
 * This is deliberately a pure function so it can be tested with the
 * classification request left pending — the state that produced the fault.
 */

export type QueryLike = {
  /** Resolved payload; `undefined` while the request is pending or failed. */
  data: unknown;
  /** Rejection, if the request failed. */
  error?: unknown;
};

export type BreakevenStatus =
  /** The report itself could not be read. */
  | "report-error"
  /** At least one input is still in flight — show the loading state. */
  | "loading"
  /** Classifications could not be read: say so, do not fall back to defaults. */
  | "classification-error"
  /** Every input resolved: figures may be calculated. */
  | "ready";

export function breakevenReadiness({
  needsClassifications,
  report,
  classifications,
  accounts,
}: {
  /**
   * False when there is no client to hold classifications (no clientId), so
   * there is nothing to wait for.
   */
  needsClassifications: boolean;
  report: QueryLike;
  classifications: QueryLike;
  accounts: QueryLike;
}): { status: BreakevenStatus; canCalculate: boolean } {
  const done = (status: BreakevenStatus) => ({ status, canCalculate: status === "ready" });

  if (report.error) return done("report-error");
  if (report.data === undefined || report.data === null) return done("loading");

  if (needsClassifications) {
    if (classifications.error || accounts.error) return done("classification-error");
    const classMissing = classifications.data === undefined || classifications.data === null;
    const accountsMissing = accounts.data === undefined || accounts.data === null;
    if (classMissing || accountsMissing) return done("loading");
  }

  return done("ready");
}
