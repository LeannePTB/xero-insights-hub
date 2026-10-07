import assert from "node:assert";
import { describe, it } from "node:test";
import { reportPeriodLabel, yearToDateComparisonLabels } from "./monthly-report";

describe("monthly report comparison period labels", () => {
  it("names the matching July periods instead of implying two completed financial years", () => {
    assert.deepStrictEqual(yearToDateComparisonLabels("2026-07-31"), {
      current: "Current period — 1–31 Jul 2026",
      prior: "Same period last year — 1–31 Jul 2025",
    });
  });

  it("names matching multi-month year-to-date windows", () => {
    assert.deepStrictEqual(yearToDateComparisonLabels("2026-09-30"), {
      current: "Current period — 1 Jul–30 Sep 2026",
      prior: "Same period last year — 1 Jul–30 Sep 2025",
    });
  });

  it("formats a window spanning calendar years explicitly", () => {
    assert.strictEqual(reportPeriodLabel("2025-07-01", "2026-03-31"), "1 Jul 2025–31 Mar 2026");
  });
});