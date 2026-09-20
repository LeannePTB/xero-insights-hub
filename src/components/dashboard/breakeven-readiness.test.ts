import { test } from "node:test";
import assert from "node:assert/strict";
import { breakevenReadiness } from "./breakeven-readiness";

const report = { data: { totalIncome: 1 } };
const resolved = { data: { rows: [] } };
const pending = { data: undefined };

test("does not calculate while the classification request is still pending", () => {
  // The exact state that produced the wrong $896 fixed-cost figure: the
  // profit-and-loss report had resolved, the classification list had not.
  const r = breakevenReadiness({
    needsClassifications: true,
    report,
    classifications: pending,
    accounts: resolved,
  });
  assert.equal(r.status, "loading");
  assert.equal(r.canCalculate, false);
});

test("does not calculate while the account list is still pending", () => {
  const r = breakevenReadiness({
    needsClassifications: true,
    report,
    classifications: resolved,
    accounts: pending,
  });
  assert.equal(r.status, "loading");
  assert.equal(r.canCalculate, false);
});

test("reports a failed classification read instead of falling back to defaults", () => {
  const r = breakevenReadiness({
    needsClassifications: true,
    report,
    classifications: { data: undefined, error: new Error("nope") },
    accounts: resolved,
  });
  assert.equal(r.status, "classification-error");
  assert.equal(r.canCalculate, false);
});

test("reports a failed account read the same way", () => {
  const r = breakevenReadiness({
    needsClassifications: true,
    report,
    classifications: resolved,
    accounts: { data: undefined, error: new Error("nope") },
  });
  assert.equal(r.status, "classification-error");
});

test("waits for the report itself", () => {
  const r = breakevenReadiness({
    needsClassifications: true,
    report: pending,
    classifications: resolved,
    accounts: resolved,
  });
  assert.equal(r.status, "loading");
});

test("surfaces a report error ahead of anything else", () => {
  const r = breakevenReadiness({
    needsClassifications: true,
    report: { data: undefined, error: new Error("xero") },
    classifications: pending,
    accounts: pending,
  });
  assert.equal(r.status, "report-error");
});

test("calculates once all three inputs have resolved", () => {
  const r = breakevenReadiness({
    needsClassifications: true,
    report,
    classifications: resolved,
    accounts: resolved,
  });
  assert.equal(r.status, "ready");
  assert.equal(r.canCalculate, true);
});

test("has nothing to wait for when there is no client holding classifications", () => {
  const r = breakevenReadiness({
    needsClassifications: false,
    report,
    classifications: pending,
    accounts: pending,
  });
  assert.equal(r.status, "ready");
});
