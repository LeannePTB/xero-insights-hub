import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ClientOrgAllowance = {
  allowance: number;
  used: number;
  isMulti: boolean;
  remaining: number;
  /** Which tier the allowance came from, e.g. "Multi company 10". */
  sourceLabel: string | null;
};

export async function getClientOrgAllowance(clientId: string): Promise<ClientOrgAllowance> {
  const [
    { data: client, error: clientError },
    { data: access, error: accessError },
    { count, error: countError },
    { data: levels },
  ] = await Promise.all([
    supabaseAdmin.from("clients").select("max_xero_orgs").eq("id", clientId).maybeSingle(),
    supabaseAdmin.from("client_access").select("tier").eq("client_id", clientId),
    supabaseAdmin
      .from("client_xero_orgs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    (supabaseAdmin as any)
      .from("plan_levels")
      .select("key, label, xero_org_limit, allows_multi_org")
      .eq("scope", "dashboard"),
  ]);

  if (clientError) throw new Error(clientError.message);
  if (accessError) throw new Error(accessError.message);
  if (countError) throw new Error(countError.message);
  if (!client) throw new Error("Client subscription not found.");

  // Multi-file support comes from the tier catalogue, so new tiers can allow it too.
  const byKey = new Map<
    string,
    { label?: string; xero_org_limit: number; allows_multi_org: boolean }
  >();
  for (const l of (levels ?? []) as any[]) byKey.set(l.key, l);
  let isMulti = false;
  let tierLimit = 1;
  let sourceLabel: string | null = null;
  for (const row of (access ?? []) as any[]) {
    const level = byKey.get(row.tier);
    if (level?.allows_multi_org) isMulti = true;
    if (level && (level.xero_org_limit ?? 1) >= tierLimit) {
      tierLimit = Math.max(tierLimit, level.xero_org_limit ?? 1);
      sourceLabel = level.label ?? row.tier;
    }
  }

  const allowance = isMulti ? Math.max(1, client.max_xero_orgs, tierLimit) : 1;
  const used = count ?? 0;
  return { allowance, used, isMulti, remaining: Math.max(0, allowance - used), sourceLabel };
}

export async function userCanManageClient(userId: string, clientId: string): Promise<boolean> {
  const [{ data: client }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("clients").select("owner_user_id, firm_id").eq("id", clientId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!client) return false;
  if (
    client.owner_user_id === userId ||
    roles?.some((row) => row.role === "advisor" || row.role === "super_admin")
  )
    return true;
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

export type ClientFirmConnectionAccess = {
  firmId: string;
  firmName: string;
  state: "ok" | "trial" | "locked";
  connectionCount: number;
  connectionLimit: number;
};

/** Resolve connection limits from the target client's organisation, never the caller's first membership. */
export async function getClientFirmConnectionAccess(
  clientId: string,
): Promise<ClientFirmConnectionAccess> {
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client?.firm_id) throw new Error("This client is not attached to an organisation.");

  const firmId = client.firm_id;
  const [{ data: firm }, { data: subscription }, { count }, { data: levels }] = await Promise.all([
    supabaseAdmin.from("firms").select("name, is_always_free").eq("id", firmId).maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("tier, status, trial_ends_at, client_limit_override")
      .eq("firm_id", firmId)
      .maybeSingle(),
    supabaseAdmin
      .from("client_xero_orgs")
      .select("id, clients!inner(firm_id)", { count: "exact", head: true })
      .eq("clients.firm_id", firmId),
    (supabaseAdmin as any).from("plan_levels").select("key, xero_org_limit").eq("scope", "firm"),
  ]);
  if (!firm) throw new Error("Organisation not found.");

  const plan = (levels ?? []).find((row: any) => row.key === subscription?.tier);
  const connectionLimit = Math.max(1, Number(plan?.xero_org_limit ?? 1));
  const status = subscription?.status ?? null;
  const trialExpired =
    status === "trialing" && subscription?.trial_ends_at
      ? new Date(subscription.trial_ends_at).getTime() < Date.now()
      : false;
  const state =
    firm.is_always_free || status === "active"
      ? "ok"
      : status === "trialing" && !trialExpired
        ? "trial"
        : "locked";

  return { firmId, firmName: firm.name, state, connectionCount: count ?? 0, connectionLimit };
}

export async function getClientFirmId(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  return (data?.firm_id as string | null) ?? null;
}

export type SelectableConnection = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_type: string | null;
  status: string | null;
  available: boolean;
  /** Caller may take this file off its current subscription and attach it here. */
  movable: boolean;
  linkedClientId: string | null;
  linkedClientName: string | null;
  linkedFirmName: string | null;
  linkedToThisClient: boolean;
};

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Candidates for linking to a client subscription.
 *
 * Scoped to the tenants authorised in this OAuth session, then to files that
 * belong to this client's organisation (or no organisation yet). Super admins
 * also see files stamped to other organisations so a file can be moved.
 *
 * Files already linked elsewhere come back with available=false plus a
 * `movable` flag, so the UI can offer "Move here" instead of a dead end.
 */
export async function getSelectableConnectionsForClient(
  clientId: string,
  tenantIds: string[],
  callerUserId?: string,
): Promise<SelectableConnection[]> {
  if (!tenantIds.length) return [];
  const firmId = await getClientFirmId(clientId);
  const superAdmin = callerUserId ? await isSuperAdmin(callerUserId) : false;

  const { data: connections, error } = await supabaseAdmin
    .from("xero_connections")
    .select("id, tenant_id, tenant_name, tenant_type, status, firm_id, created_at")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!connections?.length) return [];

  const scoped = connections.filter((c: any) =>
    superAdmin ? true : firmId ? c.firm_id === firmId || c.firm_id === null : c.firm_id === null,
  );

  const { data: assigned, error: assignedError } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("client_id, xero_connection_id, clients(name, firm_id), xero_connections(tenant_id)");
  if (assignedError) throw new Error(assignedError.message);

  const { data: firms } = await supabaseAdmin.from("firms").select("id, name");
  const firmNames = new Map<string, string>((firms ?? []).map((f: any) => [f.id, f.name]));

  const byTenant = new Map<
    string,
    { clientId: string; clientName: string | null; firmId: string | null; connectionId: string }
  >();
  for (const row of (assigned ?? []) as any[]) {
    const tid = row.xero_connections?.tenant_id;
    if (tid) {
      byTenant.set(tid, {
        clientId: row.client_id,
        clientName: row.clients?.name ?? null,
        firmId: row.clients?.firm_id ?? null,
        connectionId: row.xero_connection_id,
      });
    }
  }

  // De-dupe by tenant (a tenant may have rows for multiple connecting users).
  const seen = new Set<string>();
  const out: SelectableConnection[] = [];
  for (const c of scoped as any[]) {
    if (seen.has(c.tenant_id)) continue;
    seen.add(c.tenant_id);
    const link = byTenant.get(c.tenant_id);
    const linkedToThisClient = link?.clientId === clientId;
    const sameFirm = Boolean(link && firmId && link.firmId === firmId);
    out.push({
      // A duplicate per-user token row may exist for a tenant. Actions on an
      // assigned tenant must use the physical row referenced by the link.
      id: link?.connectionId ?? c.id,
      tenant_id: c.tenant_id,
      tenant_name: c.tenant_name,
      tenant_type: c.tenant_type ?? null,
      status: c.status ?? null,
      available: !link,
      movable: Boolean(link) && !linkedToThisClient && (superAdmin || sameFirm),
      linkedClientId: link?.clientId ?? null,
      linkedClientName: link?.clientName ?? null,
      linkedFirmName: link?.firmId ? (firmNames.get(link.firmId) ?? null) : null,
      linkedToThisClient,
    });
  }
  return out;
}

/**
 * Connections created by this user that are not linked to any client yet.
 * Used by create-client / attach flows where no OAuth session state exists.
 */
export async function getUnassignedConnectionsForUser(userId: string) {
  const { data: connections, error } = await supabaseAdmin
    .from("xero_connections")
    .select(
      "id, tenant_id, tenant_name, tenant_type, created_at, status, disconnected_at, base_currency",
    )
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

/** Unassigned Xero files belonging to an organisation, regardless of which member authorised them. */
export async function getUnassignedConnectionsForFirm(firmId: string, includeUnstamped = false) {
  let query = supabaseAdmin
    .from("xero_connections")
    .select(
      "id, tenant_id, tenant_name, tenant_type, created_at, status, disconnected_at, base_currency, firm_id",
    )
    .order("created_at", { ascending: true });
  query = includeUnstamped
    ? query.or(`firm_id.eq.${firmId},firm_id.is.null`)
    : query.eq("firm_id", firmId);
  const { data: connections, error } = await query;
  if (error) throw new Error(error.message);
  if (!connections?.length) return [];
  const { data: assigned, error: assignedError } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("xero_connection_id");
  if (assignedError) throw new Error(assignedError.message);
  const assignedIds = new Set((assigned ?? []).map((row) => row.xero_connection_id));
  return connections.filter((connection) => !assignedIds.has(connection.id));
}
