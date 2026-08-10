import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ClientOrgAllowance = {
  allowance: number;
  used: number;
  isMulti: boolean;
  remaining: number;
};

export async function getClientOrgAllowance(clientId: string): Promise<ClientOrgAllowance> {
  const [{ data: client, error: clientError }, { data: access, error: accessError }, { count, error: countError }] =
    await Promise.all([
      supabaseAdmin.from("clients").select("max_xero_orgs").eq("id", clientId).maybeSingle(),
      supabaseAdmin.from("client_access").select("id").eq("client_id", clientId).eq("tier", "multi_company").limit(1),
      supabaseAdmin.from("client_xero_orgs").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    ]);

  if (clientError) throw new Error(clientError.message);
  if (accessError) throw new Error(accessError.message);
  if (countError) throw new Error(countError.message);
  if (!client) throw new Error("Client subscription not found.");

  const isMulti = (access?.length ?? 0) > 0;
  const allowance = isMulti ? Math.max(1, client.max_xero_orgs) : 1;
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

export async function getUnassignedConnectionsForUser(userId: string) {
  const { data: connections, error } = await supabaseAdmin
    .from("xero_connections")
    .select("id, tenant_id, tenant_name, tenant_type, created_at, status, disconnected_at, base_currency")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!connections?.length) return [];

  const { data: allAssigned, error: assignedError } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("xero_connections(tenant_id)");
  if (assignedError) throw new Error(assignedError.message);
  const assignedTenantIds = new Set(
    (allAssigned ?? [])
      .map((row) => (row.xero_connections as { tenant_id?: string } | null)?.tenant_id)
      .filter((tenantId): tenantId is string => Boolean(tenantId)),
  );
  return connections.filter((connection) => !assignedTenantIds.has(connection.tenant_id));
}