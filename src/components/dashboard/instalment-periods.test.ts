import { describe, expect, it } from "vitest";
import { pickCurrentInstalment, remainingFyQuarters, upcomingInstalmentPeriods } from "./tax-obligations";

describe("instalment periods", () => {
  it("on 17 Oct 2026 shows Jul–Sep due 28 Oct then Oct–Dec", () => {
    const p = upcomingInstalmentPeriods("quarterly", "2026-10-17");
    expect(p.map((x) => [x.label, x.due])).toEqual([["Jul–Sep 2026", "2026-10-28"], ["Oct–Dec 2026", "2027-02-28"]]);
  });
  it("quick-fill covers the rest of FY 2026–27", () => {
    expect(remainingFyQuarters("2026-10-17").map((x) => x.end)).toEqual(["2026-09-30", "2026-12-31", "2027-03-31", "2027-06-30"]);
  });
  it("tile shows the next due instalment, including $0", () => {
    const rows = [{ amount: 500, periodEnd: "2026-12-31" }, { amount: 0, periodEnd: "2026-09-30" }];
    expect(pickCurrentInstalment(rows, "quarterly", "2026-10-17")).toMatchObject({ amount: 0, due: "2026-10-28" });
    expect(pickCurrentInstalment(rows, "not_required", "2026-10-17")).toBeNull();
  });
});
