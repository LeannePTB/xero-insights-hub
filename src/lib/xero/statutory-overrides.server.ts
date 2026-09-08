// Reads the per-client statutory account overrides that classifyTaxLine
// applies. There is exactly one resolution point — classifyTaxLine — and this
// module only supplies it with rows; it never decides a category itself.
import { statutoryOverrideMap, type StatutoryOverrides } from "./tax-lines";

/**
 * Overrides for one client and one Xero file. Returns an empty map when there
 * are none, which means "use name matching", exactly as before this existed.
 * A read failure also yields an empty map: a missing override falls back to
 * the previous behaviour rather than silently reclassifying anything.
 */
export async function getStatutoryOverrides(
  db: any,
  clientId: string | null | undefined,
  tenantId: string | null | undefined,
): Promise<StatutoryOverrides> {
  if (!clientId || !tenantId) return new Map();
  try {
    const { data, error } = await db
      .from("client_statutory_accounts")
      .select("account_name, category")
      .eq("client_id", clientId)
      .eq("tenant_id", tenantId);
    if (error) return new Map();
    return statutoryOverrideMap(data ?? []);
  } catch {
    return new Map();
  }
}
