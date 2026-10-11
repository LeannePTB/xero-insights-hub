import { describe, test } from "node:test";
import assert from "node:assert";
import { protectedShareOfCash, NO_CASH_TO_COMPARE } from "./protected-money-share";

describe("protected money vs cash at bank", () => {
  test("uses cash at bank: 5,449.40 against 4,444.85 is 123% and critical", () => {
    const s = protectedShareOfCash(5449.4, 4444.85);
    assert.strictEqual(Math.round(s.pct!), 123);
    assert.strictEqual(s.level, "critical");
    assert.strictEqual(s.tooltip, "Tax and super owed is more than cash at bank.");
  });
  test("zero or negative cash at bank shows no percentage", () => {
    for (const cash of [0, -603128.53]) {
      const s = protectedShareOfCash(100, cash);
      assert.strictEqual(s.pct, null);
      assert.strictEqual(s.tooltip, NO_CASH_TO_COMPARE);
    }
  });
  test("thresholds: 75% warning, 50% watch, below quiet", () => {
    assert.strictEqual(protectedShareOfCash(75, 100).level, "warning");
    assert.strictEqual(protectedShareOfCash(50, 100).level, "watch");
    assert.strictEqual(protectedShareOfCash(49, 100).level, null);
  });
});
