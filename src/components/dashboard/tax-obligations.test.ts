import { describe, expect, it } from "vitest";
import { latestCompletedPaygMonth, netGstAmount } from "./tax-obligations";

describe("tax obligations figures", () => {
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
