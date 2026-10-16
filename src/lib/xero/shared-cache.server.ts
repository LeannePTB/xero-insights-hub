// Short shared cache for read-only Xero reference data.
//
// Scope: one backend instance, shared across requests and callers. Only
// resolved payloads are stored (never promises), so no request ever awaits
// I/O started by another.
//
// Access: this sits strictly beneath each server function's own access check
// (assertClientDataAccessForClient / assertWidgetAccess / tenant ownership),
// which runs per caller BEFORE xeroGet is reached. The key starts with the
// tenant id (xeroMemoKey), so an entry can never be served to another file.
//
// Only reference reads are cached: chart of accounts, organisation, bank
// summary, balance sheet and P&L for exact parameters. Transactions, invoices
// and anything the person is working through are always live.

export const XERO_SHARED_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 400;

const CACHEABLE_PATHS = new Set([
  "Accounts",
  "Organisation",
  "Organisations",
  "Reports/BankSummary",
  "Reports/BalanceSheet",
  "Reports/ProfitAndLoss",
]);

type Entry = { at: number; tenantId: string; value: unknown };
const store = new Map<string, Entry>();

export function isSharedCacheable(path: string): boolean {
  return CACHEABLE_PATHS.has(path);
}

export function sharedCacheGet<T>(key: string, now = Date.now()): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (now - hit.at > XERO_SHARED_CACHE_TTL_MS) {
    store.delete(key);
    return undefined;
  }
  // structuredClone: a caller mutating its copy must not change another's.
  return structuredClone(hit.value) as T;
}

export function sharedCacheSet(key: string, tenantId: string, value: unknown, now = Date.now()): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: now, tenantId, value: structuredClone(value) });
}

/** Explicit Refresh: drop every cached entry for one Xero file. */
export function sharedCacheClearTenant(tenantId: string): void {
  for (const [k, e] of store) if (e.tenantId === tenantId) store.delete(k);
}

/** Test hook only. */
export function _sharedCacheReset(): void {
  store.clear();
}
