import { describe, expect, it } from "vitest";
import { buildStoredForward, nextDueItems, nextTaxFromForward } from "./forward-stored";
import { dueNowItems } from "@/components/dashboard/tax-obligations";
import { nextTaxText } from "@/lib/health/health-checks";

// Demo Company (AU), 17 Oct 2026: GST quarterly, PAYG monthly, no lodged statement.
const runs = [
  { paymentDate: "2026-10-15", tax: 180 }, { paymentDate: "2026-10-08", tax: 131 },
  { paymentDate: "2026-10-01", tax: 439 }, { paymentDate: "2026-10-01", tax: 1032 },
  { paymentDate: "2026-09-24", tax: 213 }, { paymentDate: "2026-09-17", tax: 1032 },
];
const fwd = buildStoredForward({
  today: "2026-10-17", gstCycle: "quarterly", paygCycle: "monthly",
  gst: { statementNet: 628.19 }, payRuns: runs, payablesPayload: null, instalment: null,
  ledger: { current: { gst: 2094.2, payg: 9042 }, periodEnd: (d) => (d === "2026-09-30" ? { gst: 1466.01, payg: 7535 } : null) },
});

describe("one tax position for card, Health, Overview and report", () => {
  it("finished periods come from the ledger, with due dates from the client's settings", () => {
    expect(fwd.owing).toEqual([]);
    expect(fwd.unlodged?.map((u) => [u.kind, u.amount, u.due])).toEqual([["payg", 7535, "2026-10-21"], ["gst", 1466.01, "2026-10-28"]]);
  });
  it("PAYG finished + accruing adds up to the PAYG account in Xero", () => {
    expect(fwd.building.payg).toBe(1507);
    expect(7535 + fwd.building.payg!).toBe(9042);
    expect(fwd.building.paygPayRuns).toBe(1782);
    expect(fwd.building.paygDue).toBe("2026-11-21");
    expect(fwd.building.gstDue).toBe("2027-02-28");
  });
  it("Health footer, Overview chip and the tile show the same amounts and dates", () => {
    const next = nextTaxFromForward(fwd)!;
    expect([next.amount, next.due]).toEqual([7535, "2026-10-21"]);
    expect(next.later).toEqual([{ due: "2026-10-28", amount: 1466.01 }]);
    expect(nextTaxText(next)).toContain("~$7.5k due 21 Oct · then ~$1.5k due 28 Oct");
    const chip = dueNowItems(fwd).filter((i) => i.due === "2026-10-21").reduce((s, i) => s + i.amount, 0);
    expect(chip).toBe(next.amount);
    const report = nextDueItems(fwd, null).map((i) => [i.amount, i.due]);
    expect(report).toEqual([[7535, "2026-10-21"], [1466.01, "2026-10-28"], [1507, "2026-11-21"], [628.19, "2027-02-28"]]);
    expect(fwd.totalToPlan).toBe(Math.round((7535 + 1466.01 + 1507 + 628.19) * 100) / 100);
  });
});
