// Shared Xero request gate — pure core (no I/O), so it can be unit-tested.
//
// Every outbound Xero tenant call (Accounting, Assets, Payroll, Finance) goes
// through `runThroughGate` in api.server.ts. The store is backed by the
// database (public.xero_gate_acquire/release/backoff) so the cap holds across
// every backend instance, not just one process.
//
// Xero allows 5 concurrent, 60/minute and 5,000/day per file. We stay well
// under: 2 in flight and ~50/minute per file. Callers are QUEUED (polled with
// jitter) rather than dropped; only after a bounded wait does a call give up
// with the normal "paused" message.

export const XERO_GATE_CONCURRENCY = 2;
export const XERO_GATE_PER_MINUTE = 50;
export const XERO_GATE_LEASE_SECONDS = 30;
export const XERO_GATE_MAX_WAIT_MS = 25_000;

export interface GateStore {
  /** Returns a holder id when a slot was granted, null when the caller must wait. */
  acquire(tenantId: string): Promise<string | null>;
  release(holder: string): Promise<void>;
  backoff(tenantId: string, seconds: number): Promise<void>;
}

export type GateDeps = {
  store: GateStore;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  maxWaitMs?: number;
  now?: () => number;
};

export class XeroGateTimeoutError extends Error {}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Jittered poll delay: 250–750 ms, growing gently with attempts, capped at 2 s. */
export function pollDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(2000, 250 * Math.pow(1.4, attempt));
  return Math.round(base + random() * 500);
}

/** Seconds to back off after a 429: Retry-After if given, else exponential + jitter. */
export function backoffSeconds(retryAfter: number | null, attempt: number, random: () => number = Math.random): number {
  if (retryAfter !== null && Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 60);
  return Math.min(60, Math.pow(2, attempt) + random());
}

/** Wait for a slot, run `fn`, always release. A failing store fails open. */
export async function runThroughGate<T>(tenantId: string, fn: () => Promise<T>, deps: GateDeps): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.maxWaitMs ?? XERO_GATE_MAX_WAIT_MS);
  let holder: string | null = null;
  let attempt = 0;
  for (;;) {
    try {
      holder = await deps.store.acquire(tenantId);
    } catch {
      return fn(); // the gate must never black out every client's data
    }
    if (holder) break;
    if (now() >= deadline) throw new XeroGateTimeoutError("gate wait exceeded");
    await sleep(pollDelay(attempt++, random));
  }
  try {
    return await fn();
  } finally {
    await deps.store.release(holder).catch(() => {});
  }
}

// ---- History fill pacing --------------------------------------------------

export const FILL_GAP_MS = 1500;
export const XERO_DAY_ALLOWANCE = 5000;
export const FILL_MIN_DAY_SHARE = 0.2;
export const FILL_MIN_MINUTE_REMAINING = 15;

/** The history fill pauses when a file's day allowance is under 20% or its minute allowance is low. */
export function fillShouldPause(dayRemaining: number | null, minuteRemaining: number | null): boolean {
  if (dayRemaining !== null && dayRemaining < XERO_DAY_ALLOWANCE * FILL_MIN_DAY_SHARE) return true;
  if (minuteRemaining !== null && minuteRemaining < FILL_MIN_MINUTE_REMAINING) return true;
  return false;
}
