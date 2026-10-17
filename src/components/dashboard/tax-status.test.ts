import { describe, expect, it } from "vitest";
import { billStatus, forwardTax, organisationToday } from "./tax-obligations";

describe("lodged bill status follows the due date (Sept BAS due 21 Oct)", () => {
  it("before: Not due yet, in 4 days", () => expect(billStatus("2026-10-21", "2026-10-17", 3000)).toMatchObject({ kind: "not_due", label: "Not due yet", detail: "in 4 days" }));
  it("on: Due today", () => expect(billStatus("2026-10-21", "2026-10-21", 3000)).toMatchObject({ kind: "due_today", label: "Due today" }));
  it("after: Overdue, 3 days overdue", () => expect(billStatus("2026-10-21", "2026-10-24", 3000)).toMatchObject({ kind: "overdue", detail: "3 days overdue" }));
  it("nothing owing: Paid", () => expect(billStatus("2026-10-21", "2026-10-24", 0).label).toBe("Paid"));
  it("uses the Perth day: 16:30 UTC 20 Oct is 21 Oct in Perth", () => expect(organisationToday(new Date("2026-10-20T16:30:00Z"))).toBe("2026-10-21"));
});

describe("income tax instalments", () => {
  const base = { bills: [], today: "2026-10-17", period: { kind: "month" as const, from: "2026-10-01", asAt: "2026-10-31" }, gst: 4016.09, payg: 1871, paygRegistered: true, instalment: { amount: 3000, due: "2027-02-28" } };
  it("Not required hides the amount and adds nothing", () => {
    const f = forwardTax({ ...base, instalmentSetting: "not_required" });
    expect(f.instalment).toBeNull();
    expect(f.totalToPlan).toBe(5887.09);
  });
  it("existing instalments still show for quarterly and unset clients", () => {
    expect(forwardTax({ ...base, instalmentSetting: "quarterly" }).instalment).toEqual({ amount: 3000, due: "2027-02-28" });
    expect(forwardTax({ ...base, instalmentSetting: "unset" }).totalToPlan).toBe(8887.09);
  });
});
