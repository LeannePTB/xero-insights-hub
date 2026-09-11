import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

// Only the platform super admin crosses organisation boundaries.

export type GroupClient = {
  clientId: string;
  clientName: string;
  tenantNames: string[];
  hasXero: boolean;
  groupId: string | null;
};

export type ConsolidationGroup = {
  id: string;
  name: string;
  clients: { clientId: string; clientName: string; tenantNames: string[] }[];
};

export type ConsolidationGroupsView = {
  firmId: string;
  firmName: string;
  multiCompany: boolean;
  /** Max Xero files (clients) allowed in one consolidation group. */
  consolidationLimit: number;
  groups: ConsolidationGroup[];
  clients: GroupClient[];
};

async function assertFirmAccess(
  supabase: any,
  userId: string,
  firmId: string,
  opts?: { allowSupportRead?: boolean },
) {
  // Invariant 3: super_admin alone grants nothing. Active membership decides,
  // and the rule lives in the database (public.user_can_write_firm — membership
  // only). Read-only surfaces may additionally be reached through a live Path B
  // support grant, resolved by public.user_can_access_firm.
  const { data: isMember } = await supabase.rpc("user_can_write_firm", {
    _user_id: userId,
    _firm_id: firmId,
  });
  if (isMember !== true) {
    let allowed = false;
    if (opts?.allowSupportRead) {
      const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
      allowed = await platformStaffCanAccessFirm(userId, firmId);
    }
    if (!allowed) throw new Error("You don't have access to this organisation.");
  }


  // Consolidation groups are part of the organisation-level consolidation
  // feature — the plan decides. Fails closed.
  const { assertFirmWidget } = await import("@/lib/widget-access.server");
  await assertFirmWidget(supabase, firmId, "loan_consolidation");
}


async function firmIdForGroup(admin: any, groupId: string): Promise<string> {
  const { data } = await admin.from("consolidation_groups").select("firm_id").eq("id", groupId).maybeSingle();
  if (!data) throw new Error("Consolidation group not found.");
  return data.firm_id as string;
}

export const listConsolidationGroups = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<ConsolidationGroupsView> => {
    await assertFirmAccess(context.supabase, context.userId, data.firmId, { allowSupportRead: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: firm }, { data: sub }, { data: clients }, { data: groups }] = await Promise.all([
      supabaseAdmin.from("firms").select("id, name").eq("id", data.firmId).maybeSingle(),
      supabaseAdmin.from("subscriptions").select("tier, client_limit_override").eq("firm_id", data.firmId).maybeSingle(),
      supabaseAdmin
        .from("clients")
        .select("id, name, client_xero_orgs(xero_connections(tenant_name))")
        .eq("firm_id", data.firmId)
        .order("name"),
      supabaseAdmin
        .from("consolidation_groups")
        .select("id, name, consolidation_group_members(client_id)")
        .eq("firm_id", data.firmId)
        .order("created_at"),
    ]);
    if (!firm) throw new Error("Organisation not found.");

    const { data: planRows } = await (supabaseAdmin as any)
      .from("plan_levels")
      .select("key, client_limit, allows_multi_org")
      .eq("scope", "firm");
    const level = ((planRows ?? []) as any[]).find((p) => p.key === (sub as any)?.tier);
    const limit = (sub as any)?.client_limit_override ?? level?.client_limit ?? 1;
    const multiCompany = Boolean(level?.allows_multi_org) || limit > 1;

    const groupIdByClient = new Map<string, string>();
    for (const g of (groups ?? []) as any[]) {
      for (const m of g.consolidation_group_members ?? []) groupIdByClient.set(m.client_id, g.id);
    }

    const clientList: GroupClient[] = ((clients ?? []) as any[]).map((c) => {
      const tenantNames = (c.client_xero_orgs ?? [])
        .map((o: any) => o?.xero_connections?.tenant_name)
        .filter(Boolean) as string[];
      return {
        clientId: c.id,
        clientName: c.name,
        tenantNames,
        hasXero: tenantNames.length > 0,
        groupId: groupIdByClient.get(c.id) ?? null,
      };
    });
    const byId = new Map(clientList.map((c) => [c.clientId, c]));

    const groupList: ConsolidationGroup[] = ((groups ?? []) as any[]).map((g) => ({
      id: g.id,
      name: g.name,
      clients: (g.consolidation_group_members ?? [])
        .map((m: any) => byId.get(m.client_id))
        .filter(Boolean)
        .map((c: GroupClient) => ({ clientId: c.clientId, clientName: c.clientName, tenantNames: c.tenantNames })),
    }));

    return {
      firmId: data.firmId,
      firmName: (firm as any).name,
      multiCompany,
      consolidationLimit: Math.max(1, Number(limit)),
      groups: groupList,
      clients: clientList,
    };
  });

export const saveConsolidationGroup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; groupId?: string; name: string; clientIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    await assertFirmAccess(context.supabase, context.userId, data.firmId);
    const name = data.name.trim();
    if (!name) throw new Error("Give the group a name.");
    if (data.clientIds.length < 2) throw new Error("Select at least two companies to consolidate.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A group can hold up to the organisation's full Xero file allowance.
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("tier, client_limit_override")
      .eq("firm_id", data.firmId)
      .maybeSingle();
    const { data: planRows } = await (supabaseAdmin as any)
      .from("plan_levels")
      .select("key, client_limit")
      .eq("scope", "firm");
    const planRow = ((planRows ?? []) as any[]).find((p) => p.key === (subRow as any)?.tier);
    const groupLimit = Math.max(
      1,
      Number((subRow as any)?.client_limit_override ?? planRow?.client_limit ?? 1),
    );
    if (data.clientIds.length > groupLimit) {
      throw new Error(`This plan allows up to ${groupLimit} Xero files in a consolidation group.`);
    }

    // Every selected client must belong to this organisation.
    const { data: owned } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("firm_id", data.firmId)
      .in("id", data.clientIds);
    if ((owned ?? []).length !== data.clientIds.length) {
      throw new Error("Some selected companies don't belong to this organisation.");
    }

    let groupId = data.groupId;
    if (groupId) {
      const firmId = await firmIdForGroup(supabaseAdmin, groupId);
      if (firmId !== data.firmId) throw new Error("Consolidation group not found.");
      const { error } = await supabaseAdmin.from("consolidation_groups").update({ name }).eq("id", groupId);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("consolidation_group_members").delete().eq("group_id", groupId);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("consolidation_groups")
        .insert({ firm_id: data.firmId, name, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      groupId = created.id as string;
    }

    // A client can only sit in one group, so clear any prior membership first.
    await supabaseAdmin.from("consolidation_group_members").delete().in("client_id", data.clientIds);
    const { error: memberError } = await supabaseAdmin
      .from("consolidation_group_members")
      .insert(data.clientIds.map((clientId) => ({ group_id: groupId!, client_id: clientId })));
    if (memberError) throw new Error(memberError.message);

    return { ok: true, groupId };
  });

export const deleteConsolidationGroup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { groupId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const firmId = await firmIdForGroup(supabaseAdmin, data.groupId);
    await assertFirmAccess(context.supabase, context.userId, firmId);
    const { error } = await supabaseAdmin.from("consolidation_groups").delete().eq("id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getConsolidationGroup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { groupId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const firmId = await firmIdForGroup(supabaseAdmin, data.groupId);
    await assertFirmAccess(context.supabase, context.userId, firmId, { allowSupportRead: true });

    const [{ data: group }, { data: members }, { data: isSuperAdminRaw }] = await Promise.all([
      supabaseAdmin.from("consolidation_groups").select("id, name").eq("id", data.groupId).maybeSingle(),
      supabaseAdmin.from("consolidation_group_members").select("client_id").eq("group_id", data.groupId),
      (context.supabase as any).rpc("me_is_super_admin"),
    ]);
    const clientIds = ((members ?? []) as any[]).map((m) => m.client_id as string);
    const { data: clients } = clientIds.length
      ? await supabaseAdmin
          .from("clients")
          .select("id, name, client_xero_orgs(xero_connections(tenant_id, tenant_name))")
          .in("id", clientIds)
          .order("name")
      : { data: [] as any[] };

    const isSuperAdmin = isSuperAdminRaw === true;
    // Membership is decided by the database (public.user_can_write_firm).
    const { data: memberRaw } = await (context.supabase as any).rpc("user_can_write_firm", {
      _user_id: context.userId,
      _firm_id: firmId,
    });
    const member = memberRaw === true;
    const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
    const grantActive =
      isSuperAdmin && !member ? await platformStaffCanAccessFirm(context.userId, firmId) : false;

    return {
      firmId,
      id: (group as any)?.id as string,
      name: ((group as any)?.name as string) ?? "Group",
      // Figures come from membership of this organisation. Platform staff see
      // them only while the organisation has granted support access.
      canSeeFigures: member ? true : isSuperAdmin ? grantActive : true,



      clients: ((clients ?? []) as any[]).map((c) => ({
        clientId: c.id as string,
        clientName: c.name as string,
        orgs: (c.client_xero_orgs ?? [])
          .map((o: any) => o?.xero_connections)
          .filter(Boolean)
          .map((t: any) => ({ tenantId: t.tenant_id as string, tenantName: (t.tenant_name as string) ?? "Unknown" })),
      })),
    };
  });
