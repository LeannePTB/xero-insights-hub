import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normaliseAccountKey, revenueAccountKeys } from "@/lib/cost-classification";

describe("revenueAccountKeys", () => {
  it("recognises a revenue account whatever its P&L section", () => {
    const keys = revenueAccountKeys([
      { name: "Interest Income", type: "OTHERREVENUE", class: "REVENUE" },
      { name: "Accounting", type: "OVERHEADS", class: "EXPENSE" },
    ]);
    assert.equal(keys.has(normaliseAccountKey("Interest Income")), true);
    assert.equal(keys.has(normaliseAccountKey("Accounting")), false);
  });

  it("never treats an account with no class as revenue", () => {
    const keys = revenueAccountKeys([{ name: "Interest Income", type: null, class: null }]);
    assert.equal(keys.size, 0);
  });
});
