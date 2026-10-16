import { describe, expect, it } from "vitest";
import {
  cashCoverStatus,
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
    const r = computeHealthChecks(base({ gstCycle: "not_registered", paygCycle: "not_registered" }));
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
    atoOwed: 4980,
    gstCycle: "monthly",
    paygCycle: "monthly",
    ...over,
  };
}
