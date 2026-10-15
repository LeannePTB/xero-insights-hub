import { expect, test } from "bun:test";
import { normaliseAccountKey, revenueAccountKeys } from "@/lib/cost-classification";

test("a revenue account is recognised whatever its P&L section", () => {
  const keys = revenueAccountKeys([
    { name: "Interest Income", type: "OTHERREVENUE", class: "REVENUE" },
    { name: "Accounting", type: "OVERHEADS", class: "EXPENSE" },
  ]);
  expect(keys.has(normaliseAccountKey("Interest Income"))).toBe(true);
  expect(keys.has(normaliseAccountKey("Accounting"))).toBe(false);
});

test("an account with no class is never treated as revenue", () => {
  const keys = revenueAccountKeys([{ name: "Interest Income", type: null, class: null }]);
  expect(keys.size).toBe(0);
});
