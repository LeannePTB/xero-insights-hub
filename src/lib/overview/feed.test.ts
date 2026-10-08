import { describe, test } from "node:test";
import assert from "node:assert";
import { applyAlertStates, bankReconciledStale, type FeedEvent } from "./feed.server";

const ev = (severity: number): FeedEvent => ({ eventKey: "escalation:warning", clientId: "c1", clientName: "C", firmName: "O", kind: "escalation", severity, headline: "h", before: null, after: null, date: "2026-10-07" });
const now = new Date("2026-10-07T00:00:00Z");
const ctx = (st: any) => ({ alertStates: new Map([["c1", [st]]]), people: new Map([["u1", "Leanne"]]), now });

describe("shared acknowledge and snooze", () => {
  test("acknowledged item is hidden for everyone and names who cleared it", () => {
    const r = applyAlertStates([ev(3)], ctx({ event_key: "escalation:warning", severity_at_ack: 3, acknowledged_by: "u1", acknowledged_at: "2026-10-06T00:00:00Z" }));
    assert.strictEqual(r.visible.length, 0);
    assert.strictEqual(r.cleared[0]!.cleared!.by, "Leanne");
  });
  test("re-shown when severity rises above severity at acknowledgement", () => {
    const r = applyAlertStates([ev(4)], ctx({ event_key: "escalation:warning", severity_at_ack: 3, acknowledged_at: "2026-10-06T00:00:00Z" }));
    assert.strictEqual(r.visible.length, 1);
  });
  test("re-shown when the snooze has ended", () => {
    const r = applyAlertStates([ev(2)], ctx({ event_key: "escalation:warning", severity_at_ack: 2, snoozed_until: "2026-10-06T00:00:00Z" }));
    assert.strictEqual(r.visible.length, 1);
  });
  test("hidden while snoozed", () => {
    const r = applyAlertStates([ev(2)], ctx({ event_key: "escalation:warning", severity_at_ack: 2, snoozed_until: "2026-10-10T00:00:00Z", snoozed_by: "u1" }));
    assert.strictEqual(r.visible.length, 0);
  });
});

describe("bank not reconciled rule", () => {
  test("never reconciled is stale", () => {
    assert.strictEqual(bankReconciledStale(null, "2026-10-08"), true);
  });
  test("reconciled 14 days before the anchor is stale", () => {
    assert.strictEqual(bankReconciledStale("2026-09-24", "2026-10-08"), true);
  });
  test("reconciled 13 days before the anchor is not stale", () => {
    assert.strictEqual(bankReconciledStale("2026-09-25", "2026-10-08"), false);
  });
  test("reconciled on the anchor day is not stale", () => {
    assert.strictEqual(bankReconciledStale("2026-10-08", "2026-10-08"), false);
  });
  test("a refresh timestamp does not flag yesterday's reconciliation as 14 days old", () => {
    assert.strictEqual(bankReconciledStale("2026-10-07", "2026-10-08T03:43:12.459+00:00"), false);
    assert.strictEqual(bankReconciledStale("2026-09-24", "2026-10-08T03:43:12.459+00:00"), true);
  });
});
