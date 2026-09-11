// Single implementation of one rule: a tenant id supplied by the caller is a
// FILTER, never a GRANT (invariant 4, §10). Every server function that accepts
// both a clientId and a tenantId must prove the Xero file actually belongs to
// that client before the tenant id is used for anything.
//
// Phase 4: the proof itself lives in the database
// (public.assert_tenant_belongs_to_client) — this is a thin wrapper and there
// is no second copy.

export async function assertTenantBelongsToClient(
  supabase: any,
  clientId: string,
  tenantId: string,
) {
  const { error } = await supabase.rpc("assert_tenant_belongs_to_client", {
    _client_id: clientId,
    _tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
}
