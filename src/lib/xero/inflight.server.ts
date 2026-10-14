// In-flight sharing for identical Xero GETs within one server instance.
//
// When two dashboard cards (separate requests) ask for the same report for the
// same Xero file at the same moment, only one call goes to Xero and both get
// the result. Nothing is cached: the entry is removed the moment the call
// settles, so this never serves stale data.
//
// Access is unaffected: every caller has already passed its own server-side
// access check and resolved the tenant before reaching xeroGet. The key comes
// from xeroMemoKey, which starts with the tenant ID, so two different Xero
// files can never share a result. Each caller is audited separately.

const inflight = new Map<string, Promise<unknown>>();

export function shareInFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
