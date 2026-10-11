import { describe, expect, it } from "vitest";
import { buildProtectedMoney } from "./tax-lines";
import { protectedShareOfCash, ATO_REFUND_DUE } from "@/lib/health/protected-money-share";

describe("protected money sign rules", () => {
  it("Autotek: a debit on an ATO suspense account never nets off money owed", () => {
    const pm = buildProtectedMoney("2026-10-11", [
      { name: "GST", amount: 15513.55, category: "gst" },
      { name: "PAYG Withholdings Payable", amount: 25910, category: "payg" },
      { name: "Superannuation Payable", amount: 865.51, category: "super" },
      { name: "Suspense - ATO", amount: -71022.83, category: "ato-combined" },
    ]);
    expect(pm.total).toBeCloseTo(42289.06, 2);
  });
  it("a debit on PAYG or super is not a refund and counts as nil", () => {
    const pm = buildProtectedMoney("d", [
      { name: "GST", amount: 100, category: "gst" },
      { name: "PAYG", amount: -50, category: "payg" },
      { name: "Super", amount: -20, category: "super" },
    ]);
    expect(pm.total).toBe(100);
  });
  it("a GST refund (negative GST) reduces protected money", () => {
    const pm = buildProtectedMoney("d", [
      { name: "GST", amount: -300, category: "gst" },
      { name: "PAYG", amount: 1000, category: "payg" },
      { name: "Super", amount: 0, category: "super" },
    ]);
    expect(pm.total).toBe(700);
  });
  it("a net refund shows no percentage and the refund tooltip", () => {
    const s = protectedShareOfCash(-10608.07, 5000);
    expect(s.pct).toBeNull();
    expect(s.level).toBeNull();
    expect(s.tooltip).toBe(ATO_REFUND_DUE);
  });
});
