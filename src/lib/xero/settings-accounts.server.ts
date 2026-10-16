// Settings pages read the chart of accounts from the stored nightly snapshot
// first. Callers have already run their own access and tenant-ownership checks;
// the snapshot read uses the caller's session so RLS still applies.
import { sharedCacheClearTenant } from "./shared-cache.server";

export async function readAccountsFirst(
  supabase: any,
  conn: { tenant_id: string },
  clientId: string,
  refresh: boolean,
  xeroGet: (conn: any, path: string, params?: Record<string, string | undefined>) => Promise<any>,
): Promise<{ Accounts?: any[] }> {
  if (refresh) {
    sharedCacheClearTenant(conn.tenant_id);
  } else {
    const { readSnapshot } = await import("./snapshot-read.server");
    const hit = await readSnapshot({ supabase, tenantId: conn.tenant_id, clientId, reportKey: "accounts" }).catch(() => null);
    if (hit?.payload && Array.isArray(hit.payload.Accounts)) return hit.payload;
  }
  return xeroGet(conn, "Accounts");
}
