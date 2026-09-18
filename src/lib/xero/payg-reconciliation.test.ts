import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileBalanceAgainstPeriods } from "./payg-reconciliation";

// The case that broke: Positive Traction, 18 Sep 2026. Live PAYG balance
// $4,114 (it includes the pay run posted this morning), saved pay runs only
// reach 11 Sep and total $3,520 across August and September. The card used to
// absorb the $594 difference by reaching back to July — a month that was paid.
describe("reconcileBalanceAgainstPeriods", () => {
  const months = [
    { key: "2026-09-01", amount: 1172 },
    { key: "2026-08-01", amount: 2348 },
    { key: "2026-07-01", amount: 2937 },
  ];

  it("a live balance larger than the saved pay runs explain gives an honest residue, never an older month", () => {
    const r = reconcileBalanceAgainstPeriods(4114, months);
    assert.deepEqual(r.owing, ["2026-09-01", "2026-08-01"]);
    assert.equal(r.oldest, "2026-08-01");
    assert.equal(r.matches, false);
    assert.equal(r.accountedFor, 3520);
    assert.equal(r.residue, 594);
    assert.equal(r.residueKind, "since_last_pay_run");
    // The defect, stated as an assertion: July must never be named.
    assert.equal(r.owing.includes("2026-07-01"), false);
    assert.notEqual(r.oldest, "2026-07-01");
  });

  it("a balance that matches whole months names exactly those months", () => {
    const r = reconcileBalanceAgainstPeriods(3520, months);
    assert.deepEqual(r.owing, ["2026-09-01", "2026-08-01"]);
    assert.equal(r.oldest, "2026-08-01");
    assert.equal(r.matches, true);
    assert.equal(r.residue, 0);
    assert.equal(r.residueKind, "none");
  });

  it("a balance falling between month boundaries claims no split and reaches no further back", () => {
    // $4,000: September fits, August does not. July must not be reached.
    const r = reconcileBalanceAgainstPeriods(4000, months);
    assert.deepEqual(r.owing, ["2026-09-01"]);
    assert.equal(r.oldest, "2026-09-01");
    assert.equal(r.matches, false);
    assert.equal(r.residue, 2828);
    assert.equal(r.residueKind, "unmatched");
  });

  it("a nil balance names nothing", () => {
    const r = reconcileBalanceAgainstPeriods(0, months);
    assert.deepEqual(r.owing, []);
    assert.equal(r.oldest, null);
    assert.equal(r.residue, 0);
    assert.equal(r.residueKind, "none");
  });

  it("a balance with no saved pay runs at all is all residue since the last saved run", () => {
    const r = reconcileBalanceAgainstPeriods(594, []);
    assert.deepEqual(r.owing, []);
    assert.equal(r.oldest, null);
    assert.equal(r.residue, 594);
    assert.equal(r.residueKind, "since_last_pay_run");
  });

  it("works the same for paydays as for months", () => {
    const paydays = [
      { key: "2026-09-11", amount: 355.68 },
      { key: "2026-09-04", amount: 355.68 },
      { key: "2026-08-28", amount: 355.68 },
    ];
    const r = reconcileBalanceAgainstPeriods(1067.04, paydays);
    assert.equal(r.owing.length, 3);
    assert.equal(r.matches, true);
    const withToday = reconcileBalanceAgainstPeriods(1422.72, paydays);
    assert.equal(withToday.residue, 355.68);
    assert.equal(withToday.residueKind, "since_last_pay_run");
    assert.equal(withToday.oldest, "2026-08-28");
  });
});
