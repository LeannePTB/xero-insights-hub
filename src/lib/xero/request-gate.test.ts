import { describe, expect, test } from "bun:test";
import {
  backoffSeconds,
  fillShouldPause,
  runThroughGate,
  XeroGateTimeoutError,
  type GateStore,
} from "./request-gate";

function memoryStore(cap: number) {
  let inUse = 0;
  let pausedUntil = 0;
  let n = 0;
  const store: GateStore & { pausedUntil: () => number } = {
    async acquire() {
      if (Date.now() < pausedUntil || inUse >= cap) return null;
      inUse++;
      return `h${++n}`;
    },
    async release() {
      inUse--;
    },
    async backoff(_t, seconds) {
      pausedUntil = Date.now() + seconds * 1000;
    },
    pausedUntil: () => pausedUntil,
  };
  return store;
}

const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("Xero request gate", () => {
  test("concurrency never exceeds the cap of 2, and every call is queued not dropped", async () => {
    const store = memoryStore(2);
    let current = 0;
    let peak = 0;
    const work = async () => {
      current++;
      peak = Math.max(peak, current);
      await tick(5);
      current--;
      return 1;
    };
    const results = await Promise.all(
      Array.from({ length: 12 }, () => runThroughGate("t1", work, { store, sleep: () => tick(1), maxWaitMs: 5000 })),
    );
    expect(peak).toBe(2);
    expect(results.length).toBe(12);
  });

  test("a 429 backs off for Retry-After, otherwise exponentially", () => {
    expect(backoffSeconds(7, 1)).toBe(7);
    expect(backoffSeconds(null, 3, () => 0)).toBe(8);
    expect(backoffSeconds(500, 1)).toBe(60);
  });

  test("while backed off, callers wait instead of calling Xero", async () => {
    const store = memoryStore(2);
    await store.backoff("t1", 0.05);
    let called = false;
    const start = Date.now();
    await runThroughGate("t1", async () => { called = true; }, { store, sleep: () => tick(5), maxWaitMs: 2000 });
    expect(called).toBe(true);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  test("gives up after the bounded wait rather than hanging", async () => {
    const store = memoryStore(0);
    await expect(runThroughGate("t1", async () => 1, { store, sleep: () => tick(1), maxWaitMs: 20 })).rejects.toBeInstanceOf(XeroGateTimeoutError);
  });

  test("a broken gate store fails open", async () => {
    const store: GateStore = { acquire: async () => { throw new Error("x"); }, release: async () => {}, backoff: async () => {} };
    expect(await runThroughGate("t1", async () => 5, { store })).toBe(5);
  });
});

describe("history fill pauses on low allowance", () => {
  test("pauses under 20% of the day allowance", () => {
    expect(fillShouldPause(999, null)).toBe(true);
    expect(fillShouldPause(1000, null)).toBe(false);
  });
  test("pauses when the minute allowance is low", () => {
    expect(fillShouldPause(4000, 10)).toBe(true);
    expect(fillShouldPause(4000, 40)).toBe(false);
  });
  test("unknown allowance does not pause", () => {
    expect(fillShouldPause(null, null)).toBe(false);
  });
});
