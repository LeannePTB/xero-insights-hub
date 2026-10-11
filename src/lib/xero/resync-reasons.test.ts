import { describe, test } from "node:test";
import assert from "node:assert/strict";
const expect = (v: unknown) => ({ toBe: (e: unknown) => assert.equal(v, e) });
import { outcomeFromFailure, resyncEstimateMinutes, RESYNC_REASON } from "./resync-reasons";

describe("re-sync outcomes", () => {
  test("Xero 401/403 means reconnect", () => {
    expect(outcomeFromFailure("Xero 401 unauthorised")).toBe("reconnect");
    expect(outcomeFromFailure("connection disconnected")).toBe("reconnect");
    expect(RESYNC_REASON.reconnect).toBe("Xero connection expired — reconnect");
  });
  test("Xero 429 means busy", () => {
    expect(outcomeFromFailure("429 Too Many Requests")).toBe("rate_limited");
  });
  test("other failures stay generic", () => {
    expect(outcomeFromFailure("boom")).toBe("failed");
  });
  test("estimate is ~20s per client, at least a minute", () => {
    expect(resyncEstimateMinutes(1)).toBe(1);
    expect(resyncEstimateMinutes(30)).toBe(10);
  });
});
