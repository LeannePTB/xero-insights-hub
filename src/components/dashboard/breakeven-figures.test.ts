import { test } from "node:test";
import assert from "node:assert/strict";
import { breakevenFigures } from "./breakeven-figures";

// 1–17 Sep ≈ 0.567 months. The original card showed the period break-even
// ($52,944) beside the extrapolated monthly revenue ($88,200) while the
// verdict said Below — the two displayed numbers contradicted the verdict.
test("part-month range: verdict agrees with the two displayed monthly figures", () => {
  const months = 17 / 30; // 1–17 Sep
  const f = breakevenFigures({ income: 50_000, totalVariable: 25_000, fixedOpex: 30_000, months });
  // The reader compares the two numbers the card shows.
  assert.equal(f.aboveBreakeven, f.monthlyIncome >= f.monthlyBreakeven);
  // And they must not look contradictory: below break-even on a monthly basis.
  assert.equal(f.aboveBreakeven, false);
  assert.ok(f.monthlyIncome < f.monthlyBreakeven);
  // Concrete figures for the report: monthly break-even ≈ $105,882 vs revenue ≈ $88,235.
  assert.ok(Math.abs(f.monthlyBreakeven - 30_000 / 0.5 / months) < 1e-6);
  assert.ok(Math.abs(f.monthlyIncome - 50_000 / months) < 1e-6);
});

test("whole-month range leaves figures unchanged", () => {
  const f = breakevenFigures({ income: 50_000, totalVariable: 25_000, fixedOpex: 30_000, months: 1 });
  assert.equal(f.monthlyBreakeven, 60_000);
  assert.equal(f.monthlyIncome, 50_000);
  assert.equal(f.aboveBreakeven, false);
  assert.equal(f.monthlyOperatingResult, -5_000);
});

test("multi-month range scales every money row on the same basis", () => {
  const f = breakevenFigures({ income: 100_000, totalVariable: 50_000, fixedOpex: 40_000, months: 2 });
  assert.equal(f.monthlyFixed, 20_000);
  assert.equal(f.monthlyBreakeven, 40_000);
  assert.equal(f.monthlyIncome, 50_000);
  assert.equal(f.aboveBreakeven, true);
  assert.equal(f.monthlyOperatingResult, 5_000);
  assert.equal(f.aboveBreakeven, f.monthlyIncome >= f.monthlyBreakeven);
});

test("zero income or margin yields no break-even and a Below verdict", () => {
  const f = breakevenFigures({ income: 0, totalVariable: 0, fixedOpex: 10_000, months: 0.5 });
  assert.equal(f.monthlyBreakeven, 0);
  assert.equal(f.aboveBreakeven, true); // card hides the table in this state
});
