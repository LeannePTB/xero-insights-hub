import { describe, expect, it } from "vitest";
import { paygPeriodRows } from "./tax-obligations";
import { buildStoredForward } from "@/lib/tax/forward-stored";
import { isTaxDerivedKey } from "@/lib/tax/invalidate-tax";

const today = "2026-10-17";
// Demo Company pay runs: Oct 1,782 (running), Sep 1,718, Aug, Jul; Jun none.
const months = [
  { month: "2026-10-01", withheld: 1782, payRuns: 2, owing: true, incomplete: true },
  { month: "2026-09-01", withheld: 1718, payRuns: 2, owing: true, incomplete: false },
  { month: "2026-08-01", withheld: 1700, payRuns: 2, owing: true, incomplete: false },
  { month: "2026-07-01", withheld: 1690, payRuns: 2, owing: true, incomplete: false },
  { month: "2026-06-01", withheld: 0, payRuns: 0, owing: false, incomplete: false },
];
const ledger = {
  current: { gst: 2094.2, payg: 9042 },
  periodEnd: (d: string) => (d === "2026-09-30" ? { gst: 1466.01, payg: 7535 } : null),
};

describe("PAYG withholding cycle", () => {
  it("quarterly: BAS-quarter rows with BAS due dates; no pay runs is never Paid", () => {
    const rows = paygPeriodRows(months, "quarterly", today, [], true, true);
    expect(rows.map((r) => [r.from, r.to, r.due, r.status])).toEqual([
      ["2026-10-01", "2026-12-31", "2027-02-28", "accruing"],
      ["2026-07-01", "2026-09-30", "2026-10-28", "not_due"],
      ["2026-04-01", "2026-06-30", "2026-07-28", "no_pay_runs"],
    ]);
    expect(rows[1].withheld).toBe(1718 + 1700 + 1690);
  });

  it("monthly: one row per month, due the 21st of the next month", () => {
    const rows = paygPeriodRows(months, "monthly", today, [], true, true);
    expect(rows.map((r) => [r.from, r.due, r.status])).toEqual([
      ["2026-10-01", "2026-11-21", "accruing"],
      ["2026-09-01", "2026-10-21", "not_due"],
      ["2026-08-01", "2026-09-21", "overdue"],
      ["2026-07-01", "2026-08-21", "overdue"],
      ["2026-06-01", "2026-07-21", "no_pay_runs"],
    ]);
  });

  const forward = (paygCycle: string) => buildStoredForward({
    today, gstCycle: "quarterly", paygCycle, gst: { statementNet: 628.19 }, payRuns: [], payablesPayload: null,
    instalment: null, instalmentFrequency: "quarterly", ledger,
  });

  it("switching monthly ↔ quarterly changes tile due dates; finished + accruing still equals the ledger", () => {
    const q = forward("quarterly");
    expect(q.unlodged!.map((u) => [u.kind, u.amount, u.due])).toEqual([["gst", 1466.01, "2026-10-28"], ["payg", 7535, "2026-10-28"]]);
    expect(q.building.paygDue).toBe("2027-02-28");
    expect(q.building.gstDue).toBe("2027-02-28");
    const m = forward("monthly");
    expect(m.unlodged!.find((u) => u.kind === "payg")!.due).toBe("2026-10-21");
    expect(m.building.paygDue).toBe("2026-11-21");
    for (const f of [q, m]) {
      const finished = f.unlodged!.filter((u) => u.kind === "payg").reduce((s, u) => s + u.amount, 0);
      expect(finished + (f.building.payg ?? 0)).toBe(9042);
    }
  });

  it("saving tax settings refreshes every tax-derived read", () => {
    for (const k of ["tax-position", "health-checks", "xero-payg-withholding", "client", "income-tax-instalments"]) expect(isTaxDerivedKey([k, "x"])).toBe(true);
    expect(isTaxDerivedKey(["xero-pnl"])).toBe(false);
  });
});
