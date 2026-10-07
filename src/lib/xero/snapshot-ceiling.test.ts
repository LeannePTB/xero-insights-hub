import { describe, test } from "node:test";
import assert from "node:assert";
const expect = (v: unknown) => ({ toBe: (w: unknown) => assert.strictEqual(v, w), toEqual: (w: unknown) => assert.deepStrictEqual(v, w) });
import {
  orderByLeastRecentlyRefreshed,
  scheduledRunCallCeiling,
} from "./snapshot-keys";

describe("nightly Xero call ceiling", () => {
  test("never below the 400 floor", () => {
    expect(scheduledRunCallCeiling(0)).toBe(400);
    expect(scheduledRunCallCeiling(13)).toBe(400);
  });
  test("scales at 25 calls per file", () => {
    expect(scheduledRunCallCeiling(60)).toBe(1500);
  });
  test("hard upper bound of 3000", () => {
    expect(scheduledRunCallCeiling(500)).toBe(3000);
  });
});

describe("nightly order", () => {
  test("files skipped last night go first", () => {
    const t = ["a", "b", "c", "d"].map((tenantId) => ({ tenantId }));
    const last = new Map([
      ["a", "2026-10-06T17:05:00Z"],
      ["b", "2026-10-06T17:06:00Z"],
      ["c", "2026-10-05T17:05:00Z"],
    ]);
    expect(orderByLeastRecentlyRefreshed(t, last).map((x) => x.tenantId)).toEqual([
      "d",
      "c",
      "a",
      "b",
    ]);
  });
});
