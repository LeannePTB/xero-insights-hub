import { describe, expect, it } from "vitest";
import {
  cashCoverStatus,
  lodgedAtoBills,
  nextTaxPayment,
  nextTaxText,
  lastPeriodEnd,
  dueDateForPeriodEnd,
  taxPaymentAlert,
  debtorAlert,
  computeHealthChecks,
  monthlyCosts,
  nextAtoDueDate,
  payingOnTimeStatus,
  profitStatus,
  readProfitRows,
  splitDebtors,
  type HealthInputs,
} from "./health-checks";

const TODAY = "2026-10-16";
const inv = (amount: number, due: string) => ({ AmountDue: amount, DueDateString: `${due}T00:00:00` });

describe("Making money?", () => {
  it("green at a 5% margin", () => expect(profitStatus(5, 100)).toBe("green"));
  it("watch just under 5%", () => expect(profitStatus(4.99, 100)).toBe("watch"));
  it("watch at break-even", () => expect(profitStatus(0, 100)).toBe("watch"));
  it("red on a loss", () => expect(profitStatus(-1, 100)).toBe("red"));
  it("reads Xero's own Net Profit row from an untitled section, case-insensitively, and Total Income only", () => {
    const report = { Rows: [
      { RowType: "Section", Title: "Income", Rows: [{ RowType: "SummaryRow", Cells: [{ Value: "Total Income" }, { Value: "100" }] }] },
      { RowType: "Section", Title: "Plus Other Income", Rows: [{ RowType: "SummaryRow", Cells: [{ Value: "Total Other Income" }, { Value: "50" }] }] },
      { RowType: "Section", Title: "", Rows: [{ RowType: "Row", Cells: [{ Value: "NET PROFIT" }, { Value: "12" }] }] },
    ] };
    expect(readProfitRows(report)).toEqual({ netProfit: 12, revenue: 100 });
  });
});

describe("Cash cover", () => {
  it("green at 2 months", () => expect(cashCoverStatus(2)).toBe("green"));
  it("watch just under 2", () => expect(cashCoverStatus(1.99)).toBe("watch"));
  it("watch at half a month", () => expect(cashCoverStatus(0.5)).toBe("watch"));
  it("red under half a month", () => expect(cashCoverStatus(0.49)).toBe("red"));
  it("not available when monthly costs are zero", () => {
    const r = computeHealthChecks(base({ monthly: { months: 3, average: 0, wages: 0, other: 0 } }));
    expect(r.checks.find((c) => c.key === "cash_cover")!.status).toBe("na");
  });
  it("leaves depreciation out of monthly costs", () => {
    const report = { Rows: [
      { RowType: "Header", Cells: [{ Value: "" }, { Value: "Sep" }, { Value: "Aug" }, { Value: "Jul" }] },
      { RowType: "Section", Title: "Less Operating Expenses", Rows: [
        { RowType: "Row", Cells: [{ Value: "Wages", Attributes: [{ Id: "account", Value: "w" }] }, { Value: "300" }, { Value: "300" }, { Value: "300" }] },
        { RowType: "Row", Cells: [{ Value: "Depreciation", Attributes: [{ Id: "account", Value: "d" }] }, { Value: "900" }, { Value: "900" }, { Value: "900" }] },
      ] },
    ] };
    const accounts = [{ AccountID: "w", Name: "Wages", Class: "EXPENSE", Type: "EXPENSE" }, { AccountID: "d", Name: "Depreciation", Class: "EXPENSE", Type: "DEPRECIATN" }];
    expect(monthlyCosts([report], accounts, new Set())).toEqual({ months: 3, average: 300, wages: 300, other: 0 });
  });
});

describe("Debtor windows", () => {
  it("due exactly 90 days ago is recent; 91 days is old", () => {
    const s = splitDebtors([inv(10, "2026-07-18"), inv(20, "2026-07-17")], TODAY);
    expect(s.recent).toBe(10);
    expect(s.old).toBe(20);
    expect(s.oldestOldDue).toBe("2026-07-17");
  });
  it("due exactly 14 days ago is not late; 15 days is late", () => {
    const s = splitDebtors([inv(10, "2026-10-02"), inv(20, "2026-10-01")], TODAY);
    expect(s.late).toBe(20);
    expect(s.recent).toBe(30);
  });
  it("not-yet-due invoices are recent and never late", () => {
    expect(splitDebtors([inv(10, "2026-11-30")], TODAY)).toMatchObject({ recent: 10, late: 0 });
  });
});

describe("Paying on time?", () => {
  it("green when the late amount is under $2,000 whatever the share", () => expect(payingOnTimeStatus(1999, 2000)).toBe("green"));
  it("green under 20% late", () => expect(payingOnTimeStatus(3999, 20000)).toBe("green"));
  it("watch at 20%", () => expect(payingOnTimeStatus(4000, 20000)).toBe("watch"));
  it("watch at 50%", () => expect(payingOnTimeStatus(10000, 20000)).toBe("watch"));
  it("red over 50%", () => expect(payingOnTimeStatus(10001, 20000)).toBe("red"));
  it("nothing owing counts as on track", () => {
    const r = computeHealthChecks(base({ invoices: [] }));
    const c = r.checks.find((x) => x.key === "paying_on_time")!;
    expect([c.figure, c.status]).toEqual(["Nothing owing", "green"]);
  });
});

describe("Headline and info lines", () => {
  it("counts out of the checks that are available", () => {
    const r = computeHealthChecks(base({ cashAtBank: null }));
    expect(r.headline).toBe("2 of 2 on track");
  });
  it("monthly BAS is due on the 21st", () => expect(nextAtoDueDate("monthly", TODAY)).toBe("2026-10-21"));
  it("after the 21st, next month's 21st", () => expect(nextAtoDueDate("monthly", "2026-10-22")).toBe("2026-11-21"));
  it("quarterly BAS for Jul–Sep is due 28 Oct", () => expect(nextAtoDueDate("quarterly", TODAY)).toBe("2026-10-28"));
  it("no tax line when not registered", () => {
    const r = computeHealthChecks(base({ gstCycle: "not_registered", paygCycle: "not_registered", nextTax: null }));
    expect(r.info.find((l) => l.key === "next_tax")).toBeUndefined();
  });
  it("old debts line hidden when there are none", () => {
    expect(computeHealthChecks(base({})).info.find((l) => l.key === "old_debts")).toBeUndefined();
  });
});

function base(over: Partial<HealthInputs>): HealthInputs {
  return {
    today: TODAY,
    fyLabel: "FY26–27 to date",
    pnlYtd: { from: "2026-07-01", to: TODAY, report: { Rows: [
      { RowType: "Section", Title: "Income", Rows: [{ RowType: "SummaryRow", Cells: [{ Value: "Total Income" }, { Value: "100000" }] }] },
      { RowType: "Section", Title: "", Rows: [{ RowType: "Row", Cells: [{ Value: "Net Profit" }, { Value: "20000" }] }] },
    ] } },
    cashAtBank: 50000,
    invoices: [inv(1000, "2026-10-30")],
    monthly: { months: 3, average: 10000, wages: 6000, other: 4000 },
    nextTax: { due: "2026-10-21", amount: 4980, building: 0, periodEnd: "2026-09-30", estimate: false, later: [] },
    gstCycle: "monthly",
    paygCycle: "monthly",
    ...over,
  };
}

describe("Overview alert rules (shared with Business Health)", () => {
  const next = { due: "2026-10-21", amount: 6_205, building: 0, periodEnd: "2026-09-30", estimate: false, later: [] };
  it("tax due in 5 days and more than cash + recent debtors → Action", () => {
    expect(taxPaymentAlert({ next, today: "2026-10-16", cashAtBank: 1_000, recentDebtors: 2_000, pastDueOwing: 0 }).level).toBe("action");
  });
  it("tax due within 7 days, over cash but covered by recent debtors → Warn", () => {
    expect(taxPaymentAlert({ next, today: "2026-10-16", cashAtBank: 4_600, recentDebtors: 11_600, pastDueOwing: 0 }).level).toBe("warn");
  });
  it("7-day boundary: 7 days counts, 8 days does not", () => {
    expect(taxPaymentAlert({ next, today: "2026-10-14", cashAtBank: 0, recentDebtors: 0, pastDueOwing: 0 }).level).toBe("action");
    expect(taxPaymentAlert({ next, today: "2026-10-13", cashAtBank: 0, recentDebtors: 0, pastDueOwing: 0 }).level).toBe(null);
  });
  it("past-due tax still owing → Action even when far from the next due date", () => {
    expect(taxPaymentAlert({ next: null, today: "2026-10-16", cashAtBank: 1e6, recentDebtors: 0, pastDueOwing: 1 }).level).toBe("action");
  });
  it("cash covers the payment → no alert", () => {
    expect(taxPaymentAlert({ next, today: "2026-10-16", cashAtBank: 7_000, recentDebtors: 0, pastDueOwing: 0 }).level).toBe(null);
  });
  it("debtor alert: same thresholds as Paying on time", () => {
    expect(debtorAlert(1_999, 2_000)).toBe(null);
    expect(debtorAlert(3_492, 11_600)).toBe("warn");
    expect(debtorAlert(6_000, 10_000)).toBe("action");
    expect(debtorAlert(1_900, 10_000)).toBe(null);
  });
});

describe("Next tax payment: due now vs still building", () => {
  const cur = { gst: 4_000, payg: 2_205 };
  it("monthly: period end is last month end, due on the 21st", () => {
    expect(lastPeriodEnd("monthly", "2026-10-16")).toBe("2026-09-30");
    expect(dueDateForPeriodEnd("monthly", "2026-09-30")).toBe("2026-10-21");
  });
  it("quarterly: Jul–Sep due 28 Oct; Oct–Dec due 28 Feb", () => {
    expect(lastPeriodEnd("quarterly", "2026-10-16")).toBe("2026-09-30");
    expect(dueDateForPeriodEnd("quarterly", "2026-09-30")).toBe("2026-10-28");
    expect(dueDateForPeriodEnd("quarterly", "2026-12-31")).toBe("2027-02-28");
  });
  it("splits the balance into due now (period end) and building", () => {
    const n = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-16", current: cur,
      periodEnd: (d) => (d === "2026-09-30" ? { gst: 2_500, payg: 2_000 } : null) })!;
    expect(n.due).toBe("2026-10-21");
    expect(n.amount).toBe(4_500);
    expect(n.building).toBe(1_705);
    expect(n.periodEnd).toBe("2026-09-30");
    expect(nextTaxText(n)).toBe("Next tax payment: ~$4.5k due 21 Oct · building for next period: ~$1.7k");
  });
  it("a payment since the period end reduces due now, never below zero", () => {
    const n = nextTaxPayment({ gstCycle: "monthly", paygCycle: "not_registered", today: "2026-10-16", current: { gst: 300, payg: 0 },
      periodEnd: () => ({ gst: 2_500, payg: 0 }) })!;
    expect(n.amount).toBe(300);
    expect(n.building).toBe(0);
  });
  it("missing period-end snapshot falls back to the full balance, flagged as an estimate", () => {
    const n = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-16", current: cur, periodEnd: () => null })!;
    expect(n.amount).toBe(6_205);
    expect(n.estimate).toBe(true);
    expect(nextTaxText(n)).toContain("(estimate, full balance)");
  });
  it("after the due date has passed, everything is building for the next period", () => {
    const n = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-22", current: cur, periodEnd: () => ({ gst: 1, payg: 1 }) })!;
    expect(n.due).toBe("2026-11-21");
    expect(n.amount).toBe(null);
    expect(n.building).toBe(6_205);
  });
  it("the tax rule uses due now only", () => {
    const n = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-16", current: cur,
      periodEnd: () => ({ gst: 1_000, payg: 500 }) })!;
    expect(taxPaymentAlert({ next: n, today: "2026-10-16", cashAtBank: 2_000, recentDebtors: 0, pastDueOwing: 0 }).level).toBe(null);
  });
});

describe("lodged ATO activity-statement bills", () => {
  const bill = (o: any = {}) => ({ Type: "ACCPAY", Status: "AUTHORISED", Contact: { Name: "Australian Taxation Office" }, Reference: "Sept BAS", AmountDue: 4742, DueDateString: "2026-10-21T00:00:00", LineItems: [], ...o });
  it("matches open ATO bills naming a BAS and ignores others", () => {
    const got = lodgedAtoBills({ Invoices: [bill(), bill({ Contact: { Name: "Telstra" } }), bill({ Reference: "Income tax" }), bill({ AmountDue: 0 })] });
    expect(got).toEqual([{ due: "2026-10-21", amount: 4742, reference: "Sept BAS", contact: "Australian Taxation Office" }]);
  });
  it("due next is the lodged bill; the whole current GST + PAYG balance is building", () => {
    const next = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-16", current: { gst: 4983, payg: 1871 }, periodEnd: () => ({ gst: 5493, payg: 2437 }), lodged: lodgedAtoBills([bill()]) })!;
    expect(next.amount).toBe(4742);
    expect(next.due).toBe("2026-10-21");
    expect(next.building).toBe(6854);
    expect(next.source).toBe("lodged_bill");
  });
  it("falls back to the period-end balance method with no lodged bill", () => {
    const next = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-16", current: { gst: 4983, payg: 1871 }, periodEnd: () => ({ gst: 5493, payg: 2437 }), lodged: [] })!;
    expect(next.source).toBe("balance_sheet");
  });
  it("an unpaid lodged bill past its due date is Action", () => {
    const next = nextTaxPayment({ gstCycle: "monthly", paygCycle: "monthly", today: "2026-10-25", current: { gst: 0, payg: 0 }, periodEnd: () => null, lodged: lodgedAtoBills([bill()]) });
    expect(taxPaymentAlert({ next, today: "2026-10-25", cashAtBank: 100000, recentDebtors: 0, pastDueOwing: 0 }).level).toBe("action");
  });
});

import { cashCoverMeaning, cashCoverText, cashCoverStatus as _ccs, money as _money } from "./health-checks";
describe("cash cover wording describes the actual figure", () => {
  it("0.8 months reads as about 3½ weeks, naming debtors", () =>
    expect(cashCoverMeaning(14200 / 18500, true)).toBe("Cash and recent debtors would cover about 3½ weeks of normal costs."));
  it("1.4 months reads as about 1½ months", () => expect(cashCoverText(1.4)).toBe("about 1½ months"));
  it("3 months", () => expect(cashCoverText(3.1)).toBe("about 3 months"));
  it("cash only when no debtors", () => expect(cashCoverMeaning(2, false)).toMatch(/^Cash would cover/));
  it("0.8 months is Watch (0.5–2 months)", () => expect(_ccs(0.8)).toBe("watch"));
  it("one money style", () => { expect(_money(5066)).toBe("$5.1k"); expect(_money(13400)).toBe("$13.4k"); expect(_money(850)).toBe("$850"); });
});
