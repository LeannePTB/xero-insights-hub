import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_TIERS,
  ALL_WIDGETS,
  DEFAULT_TIER_WIDGETS,
  type DashboardTier,
  type WidgetKey,
} from "@/lib/tiers";

function sanitizeWidgets(widgets: string[] | null | undefined): WidgetKey[] {
  return (widgets ?? []).filter((w): w is WidgetKey => (ALL_WIDGETS as string[]).includes(w));
}

export const listClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId?: string } | undefined) => i ?? {})
  .handler(async ({ data, context }) => {
    // Determine the firm scope. Super-admins may pass any firmId (or none → all).
    // Everyone else is restricted to their own firm.
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isSuper = !!roleRows?.some((r: any) => r.role === "super_admin");

    let firmId: string | null = data?.firmId ?? null;
    if (!isSuper) {
      const { data: m } = await context.supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const myFirm = m?.firm_id ?? null;
      if (firmId && firmId !== myFirm) throw new Error("Not a member of that business.");
      firmId = myFirm;
      if (!firmId) return { clients: [] };
    }

    // Super admins manage every organisation, including ones they don't belong to,
    // so they read through the admin client (RLS scopes reads to firm membership).
    const db: any = isSuper
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : context.supabase;

    let q = db
      .from("clients")
      .select(
        "id, name, firm_id, created_at, dashboard_widgets, client_xero_orgs(id, xero_connection_id, xero_connections(tenant_id, tenant_name)), client_access(tier)",
      )
      .order("name");
    if (firmId) q = q.eq("firm_id", firmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const clientIds = (rows ?? []).map((c: any) => c.id);
    let configRows: any[] = [];
    if (clientIds.length) {
      const { data: cfgData } = await context.supabase
        .from("tier_widget_config")
        .select("client_id, tier, widgets")
        .or(`client_id.is.null,client_id.in.(${clientIds.join(",")})`);
      configRows = cfgData ?? [];
    }
    const byKey = new Map<string, WidgetKey[]>();
    for (const r of configRows) {
      byKey.set(`${r.client_id ?? "global"}:${r.tier}`, sanitizeWidgets(r.widgets));
    }
    function resolveTierWidgets(clientId: string): Record<DashboardTier, WidgetKey[]> {
      return Object.fromEntries(
        ALL_TIERS.map((t) => [
          t,
          byKey.get(`${clientId}:${t}`) ?? byKey.get(`global:${t}`) ?? DEFAULT_TIER_WIDGETS[t],
        ]),
      ) as Record<DashboardTier, WidgetKey[]>;
    }

    const clients = (rows ?? []).map((c: any) => {
      const grantedTiers = Array.from(
        new Set(((c.client_access ?? []) as { tier: DashboardTier }[]).map((a) => a.tier)),
      ) as DashboardTier[];
      const overrideTiers = Array.from(
        new Set(configRows.filter((r) => r.client_id === c.id).map((r) => r.tier as DashboardTier)),
      ) as DashboardTier[];
      const clientTiers = Array.from(
        new Set<DashboardTier>([...overrideTiers, ...grantedTiers]),
      ) as DashboardTier[];
      return {
        ...c,
        grantedTiers,
        clientTiers,
        tierWidgets: resolveTierWidgets(c.id),
        // null = never configured (plan default applies); an array is an explicit
        // per-client override and must win over any tier default.
        clientWidgets: Array.isArray(c.dashboard_widgets)
          ? sanitizeWidgets(c.dashboard_widgets as string[])
          : null,
      };
    });
    return { clients };
  });

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const SELECT =
      "id, name, owner_user_id, firm_id, report_basis, basis_overrides, max_xero_orgs, consolidation_mode, consolidation_org_ids, client_xero_orgs(id, xero_connection_id, xero_connections(tenant_id, tenant_name, status, disconnected_at))";
    const { data: client, error } = await context.supabase
      .from("clients")
      .select(SELECT)
      .eq("id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (client) return { client: client as any };

    // Platform admins can open clients in organisations they're not a member of.
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isSuper = !!roleRows?.some((r: any) => r.role === "super_admin");
    if (isSuper) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminClient } = await supabaseAdmin
        .from("clients")
        .select(SELECT)
        .eq("id", data.clientId)
        .maybeSingle();
      if (adminClient) return { client: adminClient as any };
    }
    throw new Error("Client not found.");
  });

export const listClientNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_notes")
      .select("id, body, author_id, created_at, updated_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.author_id).filter(Boolean)));
    let authorMap = new Map<string, { display_name: string | null; email: string | null }>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      authorMap = new Map(
        (profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name, email: p.email }]),
      );
    }
    return {
      notes: (rows ?? []).map((r: any) => ({
        ...r,
        author_name:
          authorMap.get(r.author_id)?.display_name ??
          authorMap.get(r.author_id)?.email ??
          "Unknown",
        is_mine: r.author_id === context.userId,
      })),
    };
  });

export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; body: string }) => i)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Note can't be empty.");
    if (body.length > 20000) throw new Error("Note is too long (20,000 char max).");
    const { error } = await context.supabase
      .from("client_notes")
      .insert({ client_id: data.clientId, body, author_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { noteId: string; body: string }) => i)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Note can't be empty.");
    if (body.length > 20000) throw new Error("Note is too long (20,000 char max).");
    const { error } = await context.supabase
      .from("client_notes")
      .update({ body })
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { noteId: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes").delete().eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string; xeroConnectionIds: string[]; firmId?: string }) => i)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Client name is required.");
    if (data.xeroConnectionIds.length > 1) {
      throw new Error(
        "Only the Multi company tier can link more than one Xero organisation. Create the client with one org, then grant a viewer the Multi company tier to link more.",
      );
    }
    // Resolve target firm: explicit firmId (must be a member) OR caller's first firm.
    let firmId: string | null = data.firmId ?? null;
    if (firmId) {
      const { data: membership } = await context.supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", context.userId)
        .eq("firm_id", firmId)
        .maybeSingle();
      if (!membership) {
        const { data: superRow } = await context.supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", context.userId)
          .eq("role", "super_admin")
          .maybeSingle();
        if (!superRow) throw new Error("You are not a member of that business.");
      }
    } else {
      const { data: membership } = await context.supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      firmId = membership?.firm_id ?? null;
    }

    if (!firmId) throw new Error("No business associated with your account.");

    if (data.xeroConnectionIds.length > 0) {
      const { getUnassignedConnectionsForFirm } = await import("@/lib/xero/client-orgs.server");
      const available = await getUnassignedConnectionsForFirm(firmId, true);
      if (
        data.xeroConnectionIds.some((id) => !available.some((connection) => connection.id === id))
      ) {
        throw new Error(
          "A selected Xero organisation is already assigned or belongs to another organisation.",
        );
      }
    }

    // Enforce firm subscription client quota.
    const { clientLimitFor, firmLimitCatalogue } = await import("@/lib/firmPlans");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: firmRow }, { data: subRow }, { count: usedCount }, { data: planRows }] =
      await Promise.all([
        supabaseAdmin.from("firms").select("is_always_free").eq("id", firmId).maybeSingle(),
        supabaseAdmin
          .from("subscriptions")
          .select("tier, status, client_limit_override")
          .eq("firm_id", firmId)
          .maybeSingle(),
        supabaseAdmin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("firm_id", firmId),
        (supabaseAdmin as any).from("plan_levels").select("key, client_limit").eq("scope", "firm"),
      ]);
    const limit = clientLimitFor((subRow as any)?.tier, (firmRow as any)?.is_always_free, {
      override: (subRow as any)?.client_limit_override ?? null,
      catalogue: firmLimitCatalogue(planRows as any),
    });

    const status = (subRow as any)?.status ?? null;
    const okStatus =
      !status ||
      ["active", "trialing", "past_due"].includes(status) ||
      (firmRow as any)?.is_always_free;
    if (!okStatus) {
      throw new Error(
        "This business has no active subscription. Please renew before adding clients.",
      );
    }
    if ((usedCount ?? 0) >= limit) {
      throw new Error(
        `Client limit reached (${usedCount}/${limit}). Upgrade the subscription to add more clients.`,
      );
    }

    // Super admins manage organisations they don't belong to; RLS scopes inserts to firm owners.
    const writer: any = supabaseAdmin;

    const { data: client, error } = await writer
      .from("clients")
      .insert({ name, owner_user_id: context.userId, firm_id: firmId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.xeroConnectionIds.length) {
      const rows = data.xeroConnectionIds.map((xero_connection_id) => ({
        client_id: client.id,
        xero_connection_id,
      }));
      const { error: e2 } = await writer.from("client_xero_orgs").insert(rows);
      if (e2) throw new Error(e2.message);
      await supabaseAdmin
        .from("xero_connections")
        .update({ firm_id: firmId })
        .in("id", data.xeroConnectionIds);
    }

    return { id: client.id };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    // Super admins manage every organisation; RLS scopes deletes to firm owners.
    const { data: superRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (superRow) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: adminErr } = await supabaseAdmin
        .from("clients")
        .delete()
        .eq("id", data.clientId);
      if (adminErr) throw new Error(adminErr.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("clients").delete().eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ name: data.name.trim() })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClientReportBasis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; basis: "accrual" | "cash" }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ report_basis: data.basis })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type BasisOverrideWidget =
  | "tax_liability"
  | "pnl"
  | "superannuation"
  | "payables"
  | "receivables"
  | "accounting_breakeven"
  | "true_breakeven"
  | "cashflow";

export const updateClientBasisOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; widget: BasisOverrideWidget; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error: readErr } = await context.supabase
      .from("clients")
      .select("basis_overrides")
      .eq("id", data.clientId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const current = (row?.basis_overrides as Record<string, boolean> | null) ?? {};
    const next = { ...current, [data.widget]: data.enabled };
    const { error } = await context.supabase
      .from("clients")
      .update({ basis_overrides: next })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { overrides: next };
  });

export const attachXeroOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; xeroConnectionId: string }) => i)
  .handler(async ({ data, context }) => {
    const {
      getClientOrgAllowance,
      getUnassignedConnectionsForFirm,
      userCanManageClient,
      getClientFirmId,
    } = await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId)))
      throw new Error("You cannot manage this subscription.");
    const allowance = await getClientOrgAllowance(data.clientId);
    if (allowance.remaining < 1)
      throw new Error(
        `This subscription has reached its Xero file allowance of ${allowance.allowance}.`,
      );
    const firmId = await getClientFirmId(data.clientId);
    if (!firmId) throw new Error("This client is not attached to an organisation.");
    const available = await getUnassignedConnectionsForFirm(firmId, true);
    if (!available.some((connection) => connection.id === data.xeroConnectionId)) {
      throw new Error(
        "That Xero organisation is already assigned to another client subscription or is not yours to link.",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_xero_orgs")
      .insert({ client_id: data.clientId, xero_connection_id: data.xeroConnectionId });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("xero_connections")
      .update({ firm_id: firmId })
      .eq("id", data.xeroConnectionId);
    return { ok: true };
  });

export const setClientXeroAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; allowance: number }) => i)
  .handler(async ({ data, context }) => {
    const allowance = Math.floor(data.allowance);
    if (!Number.isFinite(allowance) || allowance < 1 || allowance > 100) {
      throw new Error("Xero file allowance must be between 1 and 100.");
    }
    const { userCanManageClient, getClientOrgAllowance } =
      await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId)))
      throw new Error("You cannot manage this subscription.");
    const current = await getClientOrgAllowance(data.clientId);
    if (!current.isMulti && allowance !== 1)
      throw new Error("Only Multi company subscriptions can allow more than one Xero file.");
    if (allowance < current.used)
      throw new Error(`Unlink Xero files before reducing the allowance below ${current.used}.`);
    // Super admins manage every organisation; RLS scopes updates to their own firms.
    const { data: superRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (superRow) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: adminErr } = await supabaseAdmin
        .from("clients")
        .update({ max_xero_orgs: allowance })
        .eq("id", data.clientId);
      if (adminErr) throw new Error(adminErr.message);
      return { allowance };
    }
    const { data: updated, error } = await context.supabase
      .from("clients")
      .update({ max_xero_orgs: allowance })
      .eq("id", data.clientId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0)
      throw new Error("You cannot change this subscription's Xero file allowance.");

    return { allowance };
  });

export const detachXeroOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: readErr } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("client_id, xero_connection_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Xero link not found.");
    const { userCanManageClient } = await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, row.client_id)))
      throw new Error("You cannot unlink this Xero file.");
    const { error } = await supabaseAdmin.from("client_xero_orgs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    // Release the organisation stamp so the file can be linked elsewhere.
    if (row?.xero_connection_id) {
      const { count } = await supabaseAdmin
        .from("client_xero_orgs")
        .select("id", { count: "exact", head: true })
        .eq("xero_connection_id", row.xero_connection_id);
      if ((count ?? 0) === 0)
        await supabaseAdmin
          .from("xero_connections")
          .update({ firm_id: null })
          .eq("id", row.xero_connection_id);
      await supabaseAdmin.from("audit_log").insert({
        actor_user_id: context.userId,
        action: "xero_file_unlinked",
        target_type: "xero_connection",
        target_id: row.xero_connection_id,
        meta: { client_id: row.client_id },
      });
    }
    return { ok: true };
  });

export const listClientAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    // RLS: only advisors can SELECT access rows other than their own
    const { data: rows, error } = await context.supabase
      .from("client_access")
      .select("id, user_id, tier, created_at")
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { access: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in(
        "id",
        rows.map((r) => r.user_id),
      );
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      access: rows.map((r) => ({
        ...r,
        email: map.get(r.user_id)?.email ?? null,
        display_name: map.get(r.user_id)?.display_name ?? null,
      })),
    };
  });

export const updateClientAccessTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("client_access")
      .select("client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.client_id) {
      const { assertTierInPlanForClient } = await import("@/lib/plan-tiers.server");
      await assertTierInPlanForClient(context.userId, row.client_id, data.tier);
    }
    const { error } = await context.supabase
      .from("client_access")
      .update({ tier: data.tier })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeClientAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_access").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteClientViewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; email: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Please enter a valid email address.");

    // Advisor auth check: RLS on clients prevents non-advisors from reading any client they don't access.
    // But we want to make sure caller is advisor specifically.
    const { data: advisorRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!advisorRoles || advisorRoles.length === 0) {
      throw new Error("Only advisors can invite client viewers.");
    }

    const { assertTierInPlanForClient } = await import("@/lib/plan-tiers.server");
    await assertTierInPlanForClient(context.userId, data.clientId, data.tier);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing user by profile email
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    let userId = existing?.id as string | undefined;

    if (!userId) {
      const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
      const redirectTo = projectId ? `https://project--${projectId}.lovable.app/auth` : undefined;
      const { data: invited, error: e } = await (supabaseAdmin as any).auth.admin.inviteUserByEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (e) throw new Error(e.message);
      userId = invited?.user?.id;
      if (!userId) throw new Error("Could not create invite.");
    }

    // Ensure viewer role (handle_new_user already inserts this for fresh users)
    await (supabaseAdmin as any)
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "client_viewer" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    // Grant client access
    const { error } = await (supabaseAdmin as any)
      .from("client_access")
      .upsert(
        { client_id: data.clientId, user_id: userId, tier: data.tier },
        { onConflict: "client_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, invited: !existing };
  });

function validateViewerPassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 8)
    throw new Error("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw))
    throw new Error("Password must include at least one letter and one number.");
}

export const createClientViewerWithPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { clientId: string; email: string; password: string; tier: DashboardTier }) => i,
  )
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@") || email.length > 254)
      throw new Error("Please enter a valid email address.");
    validateViewerPassword(data.password);

    const { data: advisorRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!advisorRoles || advisorRoles.length === 0) {
      throw new Error("Only advisors can create client viewers.");
    }

    const { assertTierInPlanForClient } = await import("@/lib/plan-tiers.server");
    await assertTierInPlanForClient(context.userId, data.clientId, data.tier);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) throw new Error("An account with this email already exists.");

    const { data: created, error: cErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (cErr) throw new Error(cErr.message);
    const userId = created?.user?.id;
    if (!userId) throw new Error("Could not create account.");

    await (supabaseAdmin as any)
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "client_viewer" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    const { error: aErr } = await (supabaseAdmin as any)
      .from("client_access")
      .upsert(
        { client_id: data.clientId, user_id: userId, tier: data.tier },
        { onConflict: "client_id,user_id" },
      );
    if (aErr) throw new Error(aErr.message);

    return { ok: true, email };
  });
