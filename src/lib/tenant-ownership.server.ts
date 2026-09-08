// Single implementation of one rule: a tenant id supplied by the caller is a
// FILTER, never a GRANT (invariant 4, §10). Every server function that accepts
// both a clientId and a tenantId must prove the Xero file actually belongs to
// that client before the tenant id is used for anything.
//
// This is the only copy — do not inline a variant.

/**
 * Throws when `tenantId` is not linked to `clientId` via client_xero_orgs.
 * Read with the service role deliberately: this is an ownership proof, not a
 * visibility question, and it must not depend on the caller's own RLS view.
 */
export async function assertTenantBelongsToClient(clientId: string, tenantId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: links, error } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("xero_connections(tenant_id)")
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  const permitted = new Set(
    ((links ?? []) as any[]).map((l) => (l as any).xero_connections?.tenant_id).filter(Boolean) as string[],
  );
  if (!permitted.has(tenantId)) {
    throw new Error("That Xero organisation does not belong to this client.");
  }
}
