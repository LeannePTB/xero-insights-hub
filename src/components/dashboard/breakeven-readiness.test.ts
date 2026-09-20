import { describe, expect, it } from "bun:test";
import { breakevenReadiness } from "@/components/dashboard/breakeven-readiness";

const report = { data: { totalIncome: 1 } };
const resolved = { data: { rows: [] } };
const pending = { data: undefined };

describe("breakevenReadiness", () => {
  it("does not calculate while the classification request is still pending", () => {
    // The exact state that produced the wrong $896 fixed-cost figure: the
    // profit-and-loss report had resolved, the classification list had not.
    const r = breakevenReadiness({
      needsClassifications: true,
      report,
      classifications: pending,
      accounts: resolved,
    });
    expect(r.status).toBe("loading");
    expect(r.canCalculate).toBe(false);
  });

  it("does not calculate while the account list is still pending", () => {
    const r = breakevenReadiness({
      needsClassifications: true,
      report,
      classifications: resolved,
      accounts: pending,
    });
    expect(r.status).toBe("loading");
    expect(r.canCalculate).toBe(false);
  });

  it("reports a failed classification read instead of falling back to defaults", () => {
    const r = breakevenReadiness({
      needsClassifications: true,
      report,
      classifications: { data: undefined, error: new Error("nope") },
      accounts: resolved,
    });
    expect(r.status).toBe("classification-error");
    expect(r.canCalculate).toBe(false);
  });

  it("reports a failed account read the same way", () => {
    const r = breakevenReadiness({
      needsClassifications: true,
      report,
      classifications: resolved,
      accounts: { data: undefined, error: new Error("nope") },
    });
    expect(r.status).toBe("classification-error");
  });

  it("waits for the report itself", () => {
    const r = breakevenReadiness({
      needsClassifications: true,
      report: pending,
      classifications: resolved,
      accounts: resolved,
    });
    expect(r.status).toBe("loading");
  });

  it("surfaces a report error ahead of anything else", () => {
    const r = breakevenReadiness({
      needsClassifications: true,
      report: { data: undefined, error: new Error("xero") },
      classifications: pending,
      accounts: pending,
    });
    expect(r.status).toBe("report-error");
  });

  it("calculates once all three inputs have resolved", () => {
    const r = breakevenReadiness({
      needsClassifications: true,
      report,
      classifications: resolved,
      accounts: resolved,
    });
    expect(r.status).toBe("ready");
    expect(r.canCalculate).toBe(true);
  });

  it("has nothing to wait for when there is no client holding classifications", () => {
    const r = breakevenReadiness({
      needsClassifications: false,
      report,
      classifications: pending,
      accounts: pending,
    });
    expect(r.status).toBe("ready");
  });
});
