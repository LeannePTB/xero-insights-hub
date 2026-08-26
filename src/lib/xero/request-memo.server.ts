// Per-request memo for Xero GETs.
//
// Scope: ONE inbound request. The store is a WeakMap keyed by the current
// `Request` object, so two concurrent requests — from the same user or from
// different users — can never see each other's entries, and everything is
// collected as soon as the request object is. This is deliberately NOT a
// cross-request cache; a shared cache needs its own access model and is a
// separate piece of work.
//
// Access control is unaffected: every server function still runs its own
// `assertWidgetAccess` / tenant resolution before it ever reaches `xeroGet`.
// The memo sits strictly beneath that check and only ever returns a payload
// to the same request that fetched it.

import { getRequest } from "@tanstack/react-start/server";

type MemoStore = Map<string, Promise<unknown>>;

const stores = new WeakMap<object, MemoStore>();

/**
 * The memo key is a correctness boundary, not an optimisation detail: two
 * calls that differ in tenant, endpoint, as-at date, period range or
 * reporting basis are different reports and must never collide.
 *
 * - `tenantId` is first, so no key can be shared across Xero organisations.
 * - `base` separates the Accounting API from the Assets API (same paths could
 *   otherwise collide).
 * - every parameter is included; keys are sorted so argument order cannot
 *   produce two keys for one request, and empty/undefined values are dropped
 *   exactly the way the request builder drops them.
 * - values are encoded so a value containing `=` or `&` cannot forge a
 *   different parameter set.
 */
export function xeroMemoKey(
  base: string,
  tenantId: string,
  path: string,
  params: Record<string, string | undefined>,
): string {
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return `${base}\u0000${tenantId}\u0000${path}\u0000${parts.join("&")}`;
}

function storeForCurrentRequest(): MemoStore | null {
  let request: unknown;
  try {
    request = getRequest();
  } catch {
    // No request context (background/cron paths). Run uncached.
    return null;
  }
  if (!request || typeof request !== "object") return null;
  let store = stores.get(request as object);
  if (!store) {
    store = new Map();
    stores.set(request as object, store);
  }
  return store;
}

/**
 * Run `fetcher` at most once per (request, key).
 *
 * Failures are never memoised: the entry is removed the moment the promise
 * rejects, so a throttled or failed call is not replayed to every subsequent
 * caller in the request. Callers already awaiting that promise still see the
 * original failure, which is the same outcome they get today.
 */
export async function memoiseXeroGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const store = storeForCurrentRequest();
  if (!store) return fetcher();

  const existing = store.get(key);
  if (existing) return existing as Promise<T>;

  const pending = fetcher();
  store.set(key, pending as Promise<unknown>);
  try {
    return await pending;
  } catch (error) {
    store.delete(key);
    throw error;
  }
}
