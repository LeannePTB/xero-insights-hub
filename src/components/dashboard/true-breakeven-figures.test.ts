import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMITMENT_FIELDS,
  commitmentsTotal,
  trueBreakevenFigures,
} from "./true-breakeven-figures";

const empty = {
  loan_principal: 0,
  credit_card_interest: 0,
  owner_drawings: 0,
  tax_payments: null,
  ato_payment_plan: 0,
  equipment_finance: 0,
  other: 0,
};

test("no commitments entered leaves the figure equal to break-even", () => {
  const f = trueBreakevenFigures({
    monthlyFixed: 15873,
    grossMargin: 0.791,
    monthlyIncome: 25030,
    commitments: empty,
  });
  assert.equal(f.monthlyCommitments, 0);
  assert.equal(f.hasCommitments, false);
  assert.ok(Math.abs(f.monthlyRequiredRevenue - 15873 / 0.791) < 0.01);
});

test("a blank tax figure counts as nothing, not NaN", () => {
  assert.equal(commitmentsTotal({ ...empty, tax_payments: null, loan_principal: 1000 }), 1000);
});

test("every field is added to the money that must be covered", () => {
  const one: Record<string, number> = {};
  for (const f of COMMITMENT_FIELDS) one[f.key] = 100;
  assert.equal(commitmentsTotal(one as never), COMMITMENT_FIELDS.length * 100);
});

test("commitments raise the revenue needed, not the break-even margin", () => {
  const f = trueBreakevenFigures({
    monthlyFixed: 10000,
    grossMargin: 0.5,
    monthlyIncome: 25000,
    commitments: { ...empty, loan_principal: 2000, owner_drawings: 3000 },
  });
  assert.equal(f.monthlyCommitments, 5000);
  assert.equal(f.monthlyTotalToCover, 15000);
  assert.equal(f.monthlyRequiredRevenue, 30000);
  assert.equal(f.aboveRequired, false);
  assert.equal(f.shortfall, 5000);
});

test("revenue above the required figure reads as covered", () => {
  const f = trueBreakevenFigures({
    monthlyFixed: 10000,
    grossMargin: 0.5,
    monthlyIncome: 40000,
    commitments: { ...empty, loan_principal: 2000 },
  });
  assert.equal(f.aboveRequired, true);
  assert.equal(f.shortfall, 0);
});

test("no margin means no required revenue rather than infinity", () => {
  const f = trueBreakevenFigures({
    monthlyFixed: 10000,
    grossMargin: 0,
    monthlyIncome: 0,
    commitments: { ...empty, loan_principal: 2000 },
  });
  assert.equal(f.monthlyRequiredRevenue, 0);
  assert.equal(f.aboveRequired, false);
});
