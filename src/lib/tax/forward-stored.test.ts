import { describe, expect, it } from "bun:test";
import { buildStoredForward, paygWithheldInPeriod, superDueNext } from "./forward-stored";

const bills = { Invoices: [{ Type: "ACCPAY", Status: "AUTHORISED", AmountDue: 3000, Total: 4742, Contact: { Name: "Australian Taxation Office" }, Reference: "Sept BAS", DueDateString: "2026-10-21T00:00:00" }] };
const runs = [{ paymentDate: "2026-10-02", tax: 935.5, super: 180 }, { paymentDate: "2026-10-16", tax: 935.5, super: 373.92 }, { paymentDate: "2026-09-30", tax: 999, super: 0 }];

describe("shared forward tax (stored)", () => {
  it("PAYG building counts only paydays in the running month", () => {
    expect(paygWithheldInPeriod(runs, "2026-10-01", "2026-10-31")).toBe(1871);
  });
  it("lodged bill owing, building GST + PAYG due 21 Nov, total to plan", () => {
    const f = buildStoredForward({ today: "2026-10-16", gstCycle: "monthly", paygCycle: "monthly", gst: { statementNet: 4006 }, payRuns: runs, payablesPayload: bills, instalment: null });
    expect(f.owing).toEqual([{ amount: 3000, reference: "Sept BAS", due: "2026-10-21", overdue: false }]);
    expect(f.building.payg).toBe(1871);
    expect(f.building.total).toBe(5877);
    expect(f.building.due).toBe("2026-11-21");
    expect(f.totalToPlan).toBe(8877);
  });
  it("missing stored GST leaves building unknown, never zero", () => {
    const f = buildStoredForward({ today: "2026-10-16", gstCycle: "monthly", paygCycle: "monthly", gst: null, payRuns: runs, payablesPayload: null, instalment: null });
    expect(f.building.total).toBeNull();
  });
  it("super is due 7 business days after the oldest unpaid payday", () => {
    expect(superDueNext(373.92, runs)).toEqual({ amount: 373.92, due: "2026-10-27" });
    expect(superDueNext(0, runs)).toBeNull();
  });
});
