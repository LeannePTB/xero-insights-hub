import { describe, it, expect } from "vitest";
import { caseAdjustments, DEFAULT_CASES, project, lowestCash, salesForTarget, debtSchedule, paymentForTerm, debtAdjustment, belowZeroMonths, taxSetAside, type Baseline } from "@/lib/scenario/adjustments";
import { knownDebtLines } from "@/lib/health/health-checks.server";

const base: Baseline = { revenue: 10000, revenueByCustomer: { A: 10000 }, costs: { cogs: 2000, variable: 2000, fixed: 4000 }, accounts: {} };
const months = ["2026-10", "2026-11", "2026-12"];

describe("best / worst case", () => {
  it("worst case lowers net vs expected and best raises it", () => {
    const exp = project(base, [], months, 1000);
    const worst = project(base, caseAdjustments([], DEFAULT_CASES.worst, "2026-10"), months, 1000);
    const best = project(base, caseAdjustments([], DEFAULT_CASES.best, "2026-10"), months, 1000);
    expect(worst[0]!.scenario.net).toBeLessThan(exp[0]!.scenario.net);
    expect(best[0]!.scenario.net).toBeGreaterThan(exp[0]!.scenario.net);
    // -15% sales and +5% costs: 8500 - 8000*1.05 = 100
    expect(worst[0]!.scenario.net).toBeCloseTo(100, 2);
  });
  it("lowest cash point needs an opening figure", () => {
    expect(lowestCash(project(base, [], months, null))).toBeNull();
    const low = lowestCash(project(base, caseAdjustments([], DEFAULT_CASES.worst, "2026-10"), months, 0));
    expect(low?.month).toBe("2026-10");
  });
});

describe("target profit", () => {
  it("works backwards with the break-even margin", () => {
    // margin 60%, fixed 4000, target 2000 → 10000
    const t = salesForTarget({ baseline: base, fixedCosts: 4000, targetPerMonth: 2000, averageInvoice: 500 })!;
    expect(t.salesNeeded).toBe(10000);
    expect(t.gap).toBe(0);
    const t2 = salesForTarget({ baseline: base, fixedCosts: 4000, targetPerMonth: 5000, averageInvoice: 500 })!;
    expect(t2.salesNeeded).toBe(15000);
    expect(t2.gapPct).toBe(50);
    expect(t2.invoices).toBe(10);
    expect(t2.priceRisePct).toBe(30);
  });
  it("zero sales cannot be worked out", () => {
    expect(salesForTarget({ baseline: { ...base, revenue: 0 }, fixedCosts: 4000, targetPerMonth: 1000, averageInvoice: null })).toBeNull();
  });
  it("negative target lowers sales needed, never below zero", () => {
    expect(salesForTarget({ baseline: base, fixedCosts: 4000, targetPerMonth: -1000, averageInvoice: null })!.salesNeeded).toBe(5000);
    expect(salesForTarget({ baseline: base, fixedCosts: 4000, targetPerMonth: -99999, averageInvoice: null })!.salesNeeded).toBe(0);
  });
});

describe("debt repayment", () => {
  it("zero interest splits evenly", () => {
    expect(paymentForTerm(1200, 0, 12)).toBe(100);
    const s = debtSchedule({ id: "d", name: "ATO", balance: 1200, ratePct: 0, mode: "term", termMonths: 12, start: "2026-10" });
    expect(s.rows).toHaveLength(12);
    expect(s.totalInterest).toBe(0);
    expect(s.payoffMonth).toBe("2027-09");
  });
  it("interest-bearing level payment clears the balance", () => {
    const s = debtSchedule({ id: "d", name: "Loan", balance: 10000, ratePct: 12, mode: "term", termMonths: 12, start: "2026-10" });
    expect(s.monthlyPayment).toBeCloseTo(888.49, 2);
    expect(s.rows[s.rows.length - 1]!.balance).toBe(0);
    expect(s.totalInterest).toBeGreaterThan(600);
  });
  it("payment below interest never pays off", () => {
    expect(debtSchedule({ id: "d", name: "L", balance: 10000, ratePct: 12, mode: "payment", payment: 50, start: "2026-10" }).neverPaysOff).toBe(true);
  });
  it("repayments reduce cash and flag below-zero months", () => {
    const adj = debtAdjustment([{ id: "d", name: "L", balance: 10000, ratePct: 0, mode: "payment", payment: 5000, start: "2026-11" }])!;
    const rows = project(base, [adj], months, 0);
    expect(rows[1]!.scenario.cashMovement).toBe(rows[1]!.baseline.cashMovement - 5000);
    expect(belowZeroMonths(rows)).toEqual(["2026-11", "2026-12"]);
  });
});

describe("tax set-aside", () => {
  it("covers or falls short of each due", () => {
    const r = taxSetAside([{ month: "2026-10", amount: 10000 }, { month: "2026-11", amount: 10000 }], 10, 0, [{ label: "BAS", due: "2026-11-28", amount: 1500 }]);
    expect(r.monthly).toEqual([1000, 1000]);
    expect(r.checks[0]).toMatchObject({ covered: false, difference: -500 });
    const r2 = taxSetAside([{ month: "2026-10", amount: 10000 }, { month: "2026-11", amount: 10000 }], 10, 5, [{ label: "BAS", due: "2026-11-28", amount: 1500 }]);
    expect(r2.checks[0]).toMatchObject({ covered: true, difference: 0 });
  });
  it("zero sales sets nothing aside", () => {
    expect(taxSetAside([{ month: "2026-10", amount: 0 }], 10, 0, []).monthly).toEqual([0]);
  });
});

describe("known debts from the balance sheet", () => {
  it("picks loan and ATO liabilities only", () => {
    const bs = { Reports: [{ Rows: [{ Title: "Assets", Rows: [{ RowType: "Row", Cells: [{ Value: "Loan to director" }, { Value: "500" }] }] }, { Title: "Liabilities", Rows: [{ RowType: "Section", Rows: [{ RowType: "Row", Cells: [{ Value: "Business Loan" }, { Value: "12,000.00" }] }, { RowType: "Row", Cells: [{ Value: "Accounts Payable" }, { Value: "900" }] }] }] }] }] };
    expect(knownDebtLines(bs)).toEqual([{ name: "Business Loan", balance: 12000 }]);
  });
});
