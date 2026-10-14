import { describe, expect, it } from "vitest";
import { attentionCounts, matchesAttention } from "@/lib/overview/attention";

const now = new Date("2026-10-14T09:00:00Z").getTime();
const base = { cash: 1000, protectedMoney: 500, debtorsOver60: 0, freshAsAt: "2026-10-14T01:00:00Z", xeroNeedsAttention: false };

describe("overview attention counts", () => {
  it("cash below what's owed when tax & super owed exceeds cash at bank", () => {
    expect(matchesAttention({ ...base, protectedMoney: 1500 }, "cash_below_owed", now)).toBe(true);
    expect(matchesAttention(base, "cash_below_owed", now)).toBe(false);
  });
  it("overdrawn only when cash at bank is negative", () => {
    expect(matchesAttention({ ...base, cash: -1 }, "overdrawn", now)).toBe(true);
    expect(matchesAttention({ ...base, cash: 0 }, "overdrawn", now)).toBe(false);
  });
  it("overdue receivables when anything is more than 60 days overdue", () => {
    expect(matchesAttention({ ...base, debtorsOver60: 10 }, "overdue_receivables", now)).toBe(true);
    expect(matchesAttention({ ...base, debtorsOver60: null }, "overdue_receivables", now)).toBe(false);
  });
  it("out of date after 2 days or when Xero needs attention", () => {
    expect(matchesAttention({ ...base, freshAsAt: "2026-10-11T08:00:00Z" }, "out_of_date", now)).toBe(true);
    expect(matchesAttention({ ...base, xeroNeedsAttention: true }, "out_of_date", now)).toBe(true);
    expect(matchesAttention(base, "out_of_date", now)).toBe(false);
  });
  it("counts clients, never sums money", () => {
    expect(attentionCounts([{ ...base, cash: -5 }, { ...base, cash: -900 }], now).overdrawn).toBe(2);
  });
});
