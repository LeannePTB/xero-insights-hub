import { describe, it, expect } from "vitest";
import { resolveGstMethod, gstMethodLabel, paymentGst, unfiledCutoff } from "../src/lib/xero/gst-activity";
import { basDueDate, currentGstPeriod, forwardTax } from "../src/components/dashboard/tax-obligations";
import { financialYear, pnlPoints } from "../src/lib/charts/standard";

describe("GST method", () => {
  it("adviser override beats Xero", () => expect(gstMethodLabel(resolveGstMethod("accrual", "CASH"))).toBe("Accrual basis (set by your adviser)"));
  it("uses Xero by default", () => expect(gstMethodLabel(resolveGstMethod(null, "CASH"))).toBe("Cash basis (from Xero)"));
  it("blank Xero setting asks the practice", () => expect(resolveGstMethod(null, "NONE").method).toBeNull());
});
describe("cash GST", () => {
  it("takes each payment's share of invoice tax", () => {
    const r = paymentGst([{ PaymentType: "ACCRECPAYMENT", Amount: 550, Invoice: { InvoiceID: "a" } }], new Map([["a", { Total: 1100, TotalTax: 100 }]]));
    expect(r.sales).toBe(50);
  });
  it("cut-off is the day after the lodged bill (Sydney)", () => expect(unfiledCutoff("2026-10-04")).toBe("2026-10-04T14:00:00Z"));
});
describe("forward tax", () => {
  it("monthly BAS due 21st next month", () => expect(basDueDate("month", "2026-10-31")).toBe("2026-11-21"));
  it("December quarter due 28 Feb", () => expect(basDueDate("quarter", "2026-12-31")).toBe("2027-02-28"));
  it("running quarter", () => expect(currentGstPeriod("quarterly", "2026-10-16")).toEqual({ kind: "quarter", from: "2026-10-01", asAt: "2026-12-31" }));
  it("totals owing + building and flags overdue", () => {
    const f = forwardTax({ bills: [{ due: "2026-10-21", amount: 3000, reference: "Sept BAS", contact: "ATO" }], today: "2026-10-22", period: { kind: "month", from: "2026-10-01", asAt: "2026-10-31" }, gst: 4006, payg: 1871, paygRegistered: true, instalment: null });
    expect(f.owing[0].overdue).toBe(true);
    expect(f.building.total).toBe(5877);
    expect(f.totalToPlan).toBe(8877);
  });
});
describe("P&L chart range", () => {
  it("labels the Australian financial year", () => expect(financialYear("2026-10-16").label).toBe("FY26–27"));
  it("shows July to current month, current partial", () => {
    const p = pnlPoints([], "2026-10-16");
    expect(p.map(x => x.label)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10 *"]);
  });
});
