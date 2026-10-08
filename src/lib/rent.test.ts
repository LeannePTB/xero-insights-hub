import { describe, expect, it } from "vitest";
import { matchRentReceipts, rentPosition, type RentalPropertyConfig } from "./rent";

const weekly: RentalPropertyConfig = {
  matchType: "contact",
  matchIds: ["c1"],
  expectedAmount: 500,
  frequency: "weekly",
  leaseStart: "2026-09-01",
};

describe("rent position", () => {
  it("is paid ahead when receipts cover past today", () => {
    const p = rentPosition(weekly, [{ date: "2026-09-01", amount: 3000 }], "2026-10-08", "2025-09-01");
    // 6 weeks from 1 Sep = 13 Oct
    expect(p.paidUpTo).toBe("2026-10-13");
    expect(p.status).toBe("ahead");
    expect(p.arrearsAmount).toBe(0);
  });

  it("is due when less than one period behind", () => {
    const p = rentPosition(weekly, [{ date: "2026-09-01", amount: 2500 }], "2026-10-08", "2025-09-01");
    expect(p.paidUpTo).toBe("2026-10-06");
    expect(p.status).toBe("due");
  });

  it("is in arrears with amount when more than a period behind", () => {
    const p = rentPosition(weekly, [{ date: "2026-09-01", amount: 1000 }], "2026-10-08", "2025-09-01");
    expect(p.status).toBe("arrears");
    expect(p.paidUpTo).toBe("2026-09-15");
    // 37 days = 5.2857 weeks elapsed, 2 paid
    expect(p.arrearsAmount).toBeCloseTo(1642.86, 1);
    expect(p.daysBehind).toBe(23);
  });

  it("handles fortnightly and monthly periods", () => {
    const f = rentPosition({ ...weekly, frequency: "fortnightly", expectedAmount: 1000 },
      [{ date: "2026-09-01", amount: 3000 }], "2026-10-08", "2025-09-01");
    expect(f.paidUpTo).toBe("2026-10-13");
    const m = rentPosition({ ...weekly, frequency: "monthly", expectedAmount: 2000, leaseStart: "2026-08-01" },
      [{ date: "2026-08-01", amount: 4000 }], "2026-10-08", "2025-09-01");
    expect(m.paidUpTo).toBe("2026-10-01");
    expect(m.status).toBe("due");
  });

  it("shows no rent rather than a guess when nothing matched", () => {
    const p = rentPosition(weekly, [], "2026-10-08", "2025-09-01");
    expect(p.status).toBe("no_rent");
    expect(p.paidUpTo).toBeNull();
  });
});

describe("matching", () => {
  it("matches by contact, account id or code, and tracking option id", () => {
    const bank = [
      { DateString: "2026-10-01T00:00:00", Contact: { ContactID: "c1" }, Total: 500,
        LineItems: [{ AccountCode: "200", LineAmount: 500, Tracking: [{ TrackingOptionID: "t1" }] }] },
      { DateString: "2026-10-02T00:00:00", Contact: { ContactID: "c2" }, Total: 90,
        LineItems: [{ AccountID: "a9", LineAmount: 90 }] },
    ];
    const byContact = matchRentReceipts(weekly, bank, []);
    expect(byContact).toEqual([{ date: "2026-10-01", amount: 500 }]);
    const byAccount = matchRentReceipts({ ...weekly, matchType: "account", matchIds: ["a1"] }, bank, [],
      new Map([["200", "a1"]]));
    expect(byAccount).toEqual([{ date: "2026-10-01", amount: 500 }]);
    const byTracking = matchRentReceipts({ ...weekly, matchType: "tracking", matchIds: ["t1"] }, bank, []);
    expect(byTracking.length).toBe(1);
  });

  it("uses the paid date on paid invoices", () => {
    const inv = [{ FullyPaidOnDate: "/Date(1790812800000+0000)/", Contact: { ContactID: "c1" }, Total: 500 }];
    expect(matchRentReceipts(weekly, [], inv)[0]?.date).toBe("2026-10-01");
  });
});
