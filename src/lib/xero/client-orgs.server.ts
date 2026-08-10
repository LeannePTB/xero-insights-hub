import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ClientOrgAllowance = {
  allowance: number;
  used: number;
  isMulti: boolean;
  remaining: number;
};

export async function getClientOrgAllowance(clientId: string): Promise<ClientOrgAllowance> {
  const [{ data: client, error: clientError }, { data: access, error: accessError }, { count, error: countError }, { data: levels }] =
    await Promise.all([
      supabaseAdmin.from("clients").select("max_xero_orgs").eq("id", clientId).maybeSingle(),
      supabaseAdmin.from("client_access").select("tier").eq("client_id", clientId),
      supabaseAdmin.from("client_xero_orgs").select("id", { count: "exact", head: true }).eq("client_id", clientId),
      (supabaseAdmin as any).from("plan_levels").select("key, xero_org_limit, allows_multi_org").eq("scope", "dashboard"),
    ]);

  if (clientError) throw new Error(clientError.message);
  if (accessError) throw new Error(accessError.message);
  if (countError) throw new Error(countError.message);
  if (!client) throw new Error("Client subscription not found.");

  // Multi-file support comes from the tier catalogue, so new tiers can allow it too.
  const byKey = new Map<string, { xero_org_limit: number; allows_multi_org: boolean }>();
  for (const l of (levels ?? []) as any[]) byKey.set(l.key, l);
  let isMulti = false;
  let tierLimit = 1;
  for (const row of (access ?? []) as any[]) {
    const level = byKey.get(row.tier);
    if (level?.allows_multi_org) isMulti = true;
    if (level) tierLimit = Math.max(tierLimit, level.xero_org_limit ?? 1);
  }

  const allowance = isMulti ? Math.max(1, client.max_xero_orgs, tierLimit) : 1;
  const used = count ?? 0;
  return { allowance, used, isMulti, remaining: Math.max(0, allowance - used) };
}


export async function userCanManageClient(userId: string, clientId: string): Promise<boolean> {
  const [{ data: client }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("clients").select("owner_user_id, firm_id").eq("id", clientId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!client) return false;
  if (client.owner_user_id === userId || roles?.some((row) => row.role === "advisor" || row.role === "super_admin")) return true;
  if (!client.firm_id) return false;
  const { data: membership } = await supabaseAdmin
    .from("firm_members")
    .select("id")
    .eq("firm_id", client.firm_id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return Boolean(membership);
}

export async function getClientFirmId(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("clients").select("firm_id").eq("id", clientId).maybeSingle();
  return (data?.firm_id as string | null) ?? null;
}

export type SelectableConnection = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_type: string | null;
  status: string | null;
  available: boolean;
  linkedClientName: string | null;
  linkedToThisClient: boolean;
};

/**
 * Candidates for linking to a client subscription.
 *
 * Scoped two ways:
 *  - only tenants authorised in this OAuth session (tenantIds)
 *  - only connections that belong to this client's organisation (or are not
 *    yet stamped with one), so one login's unrelated Xero files never appear.
 *
 * Files already linked elsewhere are returned with available=false so the UI
 * can explain why they can't be picked, instead of silently dropping them.
 */
export async function getSelectableConnectionsForClient(
  clientId: string,
  tenantIds: string[],
): Promise<SelectableConnection[]> {
  if (!tenantIds.length) return [];
  const firmId = await getClientFirmId(clientId);

  const { data: connections, error } = await supabaseAdmin
    .from("xero_connections")
    .select("id, tenant_id, tenant_name, tenant_type, status, firm_id, created_at")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!connections?.length) return [];

  const scoped = connections.filter((c: any) => (firmId ? c.firm_id === firmId || c.firm_id === null : true));

  const { data: assigned, error: assignedError } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("client_id, xero_connection_id, clients(name), xero_connections(tenant_id)");
  if (assignedError) throw new Error(assignedError.message);

  const byTenant = new Map<string, { clientId: string; clientName: string | null }>();
  for (const row of (assigned ?? []) as any[]) {
    const tid = row.xero_connections?.tenant_id;
    if (tid) byTenant.set(tid, { clientId: row.client_id, clientName: row.clients?.name ?? null });
  }

  // De-dupe by tenant (a tenant may have rows for multiple connecting users).
  const seen = new Set<string>();
  const out: SelectableConnection[] = [];
  for (const c of scoped as any[]) {
    if (seen.has(c.tenant_id)) continue;
    seen.add(c.tenant_id);
    const link = byTenant.get(c.tenant_id);
    out.push({
      id: c.id,
      tenant_id: c.tenant_id,
      tenant_name: c.tenant_name,
      tenant_type: c.tenant_type ?? null,
      status: c.status ?? null,
      available: !link,
      linkedClientName: link ? link.clientName : null,
      linkedToThisClient: link?.clientId === clientId,
    });
  }
  return out;
}
