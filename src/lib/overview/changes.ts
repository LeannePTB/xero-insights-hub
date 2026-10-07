// Pure change detection for the client overview. No imports from Xero or the
// database. Staff-only.

import { BIG_MOVE } from "./thresholds";

export type MoveInput = {
  now: number | null;
  before: number | null;
  /** The same window ending at the same point last month (end and start values). */
  priorEnd: number | null;
  priorStart: number | null;
  /** Average monthly revenue, for the materiality floor. Null when unknown. */
  avgMonthlyRevenue: number | null;
};

export type MoveResult =
  | { state: "no_data" }
  | {
      state: "evaluated";
      change: number;
      relative: number | null;
      big: boolean;
      /** False when there was no prior-month history, so the routine test was skipped. */
      routineTested: boolean;
      routine: boolean;
    };

export function materialFloor(avgMonthlyRevenue: number | null): number {
  const share =
    avgMonthlyRevenue !== null && Number.isFinite(avgMonthlyRevenue) && avgMonthlyRevenue > 0
      ? avgMonthlyRevenue * BIG_MOVE.revenueShareFloor
      : 0;
  return Math.max(BIG_MOVE.minAbsoluteChange, share);
}

/** All three tests must hold: relative, material, unusual (where history allows). */
export function evaluateMove(i: MoveInput): MoveResult {
  if (i.now === null || i.before === null || !Number.isFinite(i.now) || !Number.isFinite(i.before))
    return { state: "no_data" };
  const change = i.now - i.before;
  const relative = i.before === 0 ? null : Math.abs(change) / Math.abs(i.before);
  const relativeOk = relative === null ? change !== 0 : relative >= BIG_MOVE.minRelativeChange;
  const materialOk = Math.abs(change) >= materialFloor(i.avgMonthlyRevenue);

  const routineTested =
    i.priorEnd !== null &&
    i.priorStart !== null &&
    Number.isFinite(i.priorEnd) &&
    Number.isFinite(i.priorStart);
  let routine = false;
  if (routineTested && change !== 0) {
    const priorChange = (i.priorEnd as number) - (i.priorStart as number);
    routine =
      Math.sign(priorChange) === Math.sign(change) &&
      Math.abs(priorChange) >= Math.abs(change) * BIG_MOVE.routineShareOfMove;
  }
  return {
    state: "evaluated",
    change,
    relative,
    big: relativeOk && materialOk && !routine,
    routineTested,
    routine,
  };
}

/** Severity rank for ordering and escalation: higher is worse. */
export function verdictRank(v: { state: string; severity?: string }): number {
  if (v.state === "issues") return v.severity === "critical" ? 4 : v.severity === "warning" ? 3 : 2;
  if (v.state === "ok") return 0;
  return 1; // stale, partial, disconnected, no data, unavailable: can't assess
}

export type OverviewBucket = "critical" | "warning" | "watch" | "ok" | "cant_assess";

export function bucketOf(v: { state: string; severity?: string }): OverviewBucket {
  if (v.state === "issues")
    return v.severity === "critical" ? "critical" : v.severity === "warning" ? "warning" : "watch";
  if (v.state === "ok") return "ok";
  return "cant_assess";
}

/** The Nth business day (Mon–Fri) of the month containing `date` (YYYY-MM-DD). */
export function nthBusinessDay(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y!, m! - 1, d));
    if (dt.getUTCMonth() !== m! - 1) break;
    const wd = dt.getUTCDay();
    if (wd !== 0 && wd !== 6) count++;
    if (count === n) return dt.toISOString().slice(0, 10);
  }
  return date;
}
