// Browser-side pacing for live Xero card loads (pure, no I/O of its own).
//
// The server gate already queues calls per file, but a dashboard that fires a
// dozen cards at once still makes each one sit in that queue and some time out.
// Here we (1) start at most LIVE_LOAD_CONCURRENCY card loads at a time, in the
// order cards mount, and (2) treat our own gate's "waiting" answer as
// "retry shortly" rather than an error. Only a real Xero 429 gets the paused
// wording, and that retries itself once after a minute.

export const LIVE_LOAD_CONCURRENCY = 2;
export const GATE_WAIT_MESSAGE = "Waiting for Xero — loading shortly";
const PAUSED = "Xero has paused requests for this organisation";
export const GATE_WAIT_RETRIES = 8;
export const PAUSED_RETRY_MS = 60_000;

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && typeof (e as any).message === "string") return (e as any).message;
  return "";
}

export function isGateWait(e: unknown): boolean {
  return messageOf(e).includes(GATE_WAIT_MESSAGE);
}
export function isXeroPaused(e: unknown): boolean {
  return messageOf(e).includes(PAUSED);
}

/** react-query retry policy for live Xero cards. */
export function xeroRetry(failureCount: number, error: unknown): boolean {
  if (isGateWait(error)) return failureCount < GATE_WAIT_RETRIES;
  if (isXeroPaused(error)) return failureCount < 1;
  return false;
}
export function xeroRetryDelay(failureCount: number, error: unknown): number {
  if (isXeroPaused(error)) return PAUSED_RETRY_MS;
  return Math.min(10_000, 1500 * (failureCount + 1)) + Math.round(Math.random() * 750);
}
export const xeroQueryRetry = { retry: xeroRetry, retryDelay: xeroRetryDelay } as const;

let active = 0;
const queue: (() => void)[] = [];
/** Run `fn` when one of the LIVE_LOAD_CONCURRENCY browser slots is free. */
export function staggered<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      fn().then(resolve, reject).finally(() => {
        active--;
        queue.shift()?.();
      });
    };
    if (active < LIVE_LOAD_CONCURRENCY) run();
    else queue.push(run);
  });
}

/** Test hook only. */
export function _liveLoadState() {
  return { active, queued: queue.length };
}
