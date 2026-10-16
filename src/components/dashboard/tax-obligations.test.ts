import { describe, expect, it } from "vitest";
import { latestCompletedPaygMonth, netGstAmount, lodgedBillsForPeriod, paygMonthState } from "./tax-obligations";
import { lodgedAtoBills } from "@/lib/health/health-checks";

describe("tax obligations figures", () => {
  const bills = lodgedAtoBills({ Invoices: [{ Type: "ACCPAY", Status: "AUTHORISED", Contact: { Name: "Australian Taxation Office" }, InvoiceNumber: "Sept BAS", LineItems: [{ Description: "Activity Statement for Sep 2026 - GST" }, { Description: "Activity Statement for Sep 2026 - PAYG tax withheld" }], Total: 4742, AmountDue: 3000, DueDateString: "2026-10-21T00:00:00" }] });
  it("September lodged BAS uses the bill total, unpaid amount and due date", () => {
    expect(lodgedBillsForPeriod(bills, "2026-09-01", "2026-09-30").map(({ total, amount, due }) => ({ total, amount, due }))).toEqual([{ total: 4742, amount: 3000, due: "2026-10-21" }]);
  });
  it("September PAYG remains lodged part-paid despite a cleared withholding account", () => {
    expect(paygMonthState({ month: "2026-09-01", owing: false, incomplete: false }, bills, true)).toBe("lodged_part_paid");
  });
  it("does not assign September BAS to August, October or the prior year", () => {
    for (const month of ["2026-08-01", "2026-10-01", "2025-09-01"]) expect(lodgedBillsForPeriod(bills, month, month)).toEqual([]);
  });
  it("quarterly bills cover each named quarter month, not an adjacent month", () => {
    const quarter = [{ due: "2026-10-28", amount: 100, total: 100, reference: "Jul - Sep 2026 BAS", contact: "ATO" }];
    expect(paygMonthState({ month: "2026-08-01", owing: false, incomplete: false }, quarter, true)).toBe("lodged_owing");
    expect(lodgedBillsForPeriod(quarter, "2026-10-01", "2026-10-01")).toEqual([]);
  });
  it("missing saved bills never confirm a month as paid", () => {
    expect(paygMonthState({ month: "2026-09-01", owing: false, incomplete: false }, [], false)).toBe("unknown");
  });
  it("shows September net GST of $2,211.73", () => {
    expect(netGstAmount({ gstOnSales: 2617.33, gstOnPurchases: 405.6 })).toBe(2211.73);
  });

  it("shows the latest completed PAYG month, not the current incomplete month", () => {
    const result = latestCompletedPaygMonth({
      status: "available",
      outstanding: 3023,
      accounts: [],
      months: [
        { month: "2026-10-01", withheld: 586, payRuns: 1, owing: true, incomplete: true },
        { month: "2026-09-01", withheld: 2437, payRuns: 4, owing: true, incomplete: false },
      ],
      matchesMonths: true,
      oldestOwingMonth: "2026-09-01",
      residue: 0,
      residueKind: "none",
      vintage: {
        balanceFetchedAt: "2026-10-08T00:00:00.000Z",
        payRunsFetchedAt: null,
        payRunsAsAt: null,
        payRunsFromSnapshot: true,
        payRunsComplete: true,
        latestPayRunDate: null,
        differs: false,
      },
      misfiledAccounts: [],
    });
    expect(result).toEqual({ month: "2026-09-01", amount: 2437 });
  });
});
