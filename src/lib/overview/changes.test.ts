import { describe, test } from "node:test";
import assert from "node:assert";
const expect = (v: unknown) => ({ toBe: (w: unknown) => assert.strictEqual(v, w), toEqual: (w: unknown) => assert.deepStrictEqual(v, w) });
import { bucketOf, evaluateMove, materialFloor } from "./changes";

const base = { priorEnd: null, priorStart: null, avgMonthlyRevenue: null };

describe("big move rule", () => {
  test("25% relative boundary: 24% is not big, 25% is", () => {
    const a = evaluateMove({ ...base, before: 100_000, now: 76_000 });
    const b = evaluateMove({ ...base, before: 100_000, now: 75_000 });
    expect(a.state === "evaluated" && a.big).toBe(false);
    expect(b.state === "evaluated" && b.big).toBe(true);
  });
  test("$10,000 floor: a 50% move of $9,000 is not big", () => {
    const r = evaluateMove({ ...base, before: 18_000, now: 9_000 });
    expect(r.state === "evaluated" && r.big).toBe(false);
  });
  test("floor is 10% of average monthly revenue when that is larger", () => {
    expect(materialFloor(250_000)).toBe(25_000);
    expect(materialFloor(50_000)).toBe(10_000);
    const r = evaluateMove({ ...base, avgMonthlyRevenue: 250_000, before: 60_000, now: 40_000 });
    expect(r.state === "evaluated" && r.big).toBe(false);
  });
  test("routine: same-direction move of at least half last month is filtered", () => {
    const r = evaluateMove({ before: 100_000, now: 60_000, priorStart: 100_000, priorEnd: 75_000, avgMonthlyRevenue: null });
    expect(r.state === "evaluated" && r.routine).toBe(true);
    expect(r.state === "evaluated" && r.big).toBe(false);
  });
  test("no prior-month history: routine test skipped and said so", () => {
    const r = evaluateMove({ ...base, before: 100_000, now: 60_000 });
    expect(r.state === "evaluated" && r.routineTested).toBe(false);
    expect(r.state === "evaluated" && r.big).toBe(true);
  });
  test("missing figure is no data, never a move", () => {
    expect(evaluateMove({ ...base, before: null, now: 5 }).state).toBe("no_data");
  });
});

describe("buckets", () => {
  test("stale, partial and disconnected are never all clear", () => {
    for (const state of ["stale", "partial", "disconnected", "no_data", "unavailable"])
      expect(bucketOf({ state })).toBe("cant_assess");
  });
});

import { nthBusinessDay, verdictRank } from "./changes";
describe("report-not-sent point and escalation rank", () => {
  test("15th business day of October 2026 is 21 Oct", () => {
    expect(nthBusinessDay("2026-10-07", 15)).toBe("2026-10-21");
  });
  test("watch to critical is a worsening; staying critical is not", () => {
    expect(verdictRank({ state: "issues", severity: "critical" }) > verdictRank({ state: "issues", severity: "watch" })).toBe(true);
    expect(verdictRank({ state: "issues", severity: "critical" }) > verdictRank({ state: "issues", severity: "critical" })).toBe(false);
    expect(verdictRank({ state: "issues", severity: "watch" }) > verdictRank({ state: "ok" })).toBe(true);
  });
});
