import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_TIERS, ALL_WIDGETS, DEFAULT_TIER_WIDGETS, type DashboardTier, type WidgetKey } from "@/lib/tiers";

function sanitizeWidgets(widgets: string[] | null | undefined): WidgetKey[] {
  return (widgets ?? []).filter((w): w is WidgetKey => (ALL_WIDGETS as string[]).includes(w));
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select(
        "id, name, created_at, client_xero_orgs(id, xero_connection_id, xero_connections(tenant_id, tenant_name)), client_access(tier)",
      )
      .order("name");
    if (error) throw new Error(error.message);

    const clientIds = (data ?? []).map((c: any) => c.id);
    let configRows: any[] = [];
    if (clientIds.length) {
      const { data: cfg } = await context.supabase
        .from("tier_widget_config")
        .select("client_id, tier, widgets")
        .or(`client_id.is.null,client_id.in.(${clientIds.join(",")})`);
      configRows = cfg ?? [];
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

    const clients = (data ?? []).map((c: any) => {
      const grantedTiers = Array.from(
        new Set(((c.client_access ?? []) as { tier: DashboardTier }[]).map((a) => a.tier)),
      ) as DashboardTier[];
      return {
        ...c,
        grantedTiers,
        tierWidgets: resolveTierWidgets(c.id),
      };
    });
    return { clients };
  });

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: client, error } = await context.supabase
      .from("clients")
      .select(
        "id, name, owner_user_id, report_basis, client_xero_orgs(id, xero_connection_id, xero_connections(tenant_id, tenant_name))",
      )
      .eq("id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!client) throw new Error("Client not found.");
    return { client: client as any };
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
      authorMap = new Map((profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name, email: p.email }]));
    }
    return {
      notes: (rows ?? []).map((r: any) => ({
        ...r,
        author_name: authorMap.get(r.author_id)?.display_name ?? authorMap.get(r.author_id)?.email ?? "Unknown",
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


async function clientIsMultiCompany(supabase: any, clientId: string) {
  const { data, error } = await supabase
    .from("client_access")
    .select("id")
    .eq("client_id", clientId)
    .eq("tier", "multi_company")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string; xeroConnectionIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Client name is required.");
    if (data.xeroConnectionIds.length > 1) {
      throw new Error(
        "Only the Multi company tier can link more than one Xero organisation. Create the client with one org, then grant a viewer the Multi company tier to link more.",
      );
    }
    const { data: client, error } = await context.supabase
      .from("clients")
      .insert({ name, owner_user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.xeroConnectionIds.length) {
      const rows = data.xeroConnectionIds.map((xero_connection_id) => ({
        client_id: client.id,
        xero_connection_id,
      }));
      const { error: e2 } = await context.supabase.from("client_xero_orgs").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return { id: client.id };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
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

export const attachXeroOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; xeroConnectionId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: existing, error: countErr } = await context.supabase
      .from("client_xero_orgs")
      .select("id")
      .eq("client_id", data.clientId);
    if (countErr) throw new Error(countErr.message);
    if ((existing?.length ?? 0) >= 1) {
      const multi = await clientIsMultiCompany(context.supabase, data.clientId);
      if (!multi) {
        throw new Error(
          "Only the Multi company tier can link more than one Xero organisation. Grant a viewer the Multi company tier for this client first.",
        );
      }
    }
    const { error } = await context.supabase
      .from("client_xero_orgs")
      .insert({ client_id: data.clientId, xero_connection_id: data.xeroConnectionId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const detachXeroOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_xero_orgs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
      .in("id", rows.map((r) => r.user_id));
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
      .upsert({ user_id: userId, role: "client_viewer" }, { onConflict: "user_id,role", ignoreDuplicates: true });

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
  if (typeof pw !== "string" || pw.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new Error("Password must include at least one letter and one number.");
}

export const createClientViewerWithPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; email: string; password: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@") || email.length > 254) throw new Error("Please enter a valid email address.");
    validateViewerPassword(data.password);

    const { data: advisorRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!advisorRoles || advisorRoles.length === 0) {
      throw new Error("Only advisors can create client viewers.");
    }

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
      .upsert({ user_id: userId, role: "client_viewer" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    const { error: aErr } = await (supabaseAdmin as any)
      .from("client_access")
      .upsert(
        { client_id: data.clientId, user_id: userId, tier: data.tier },
        { onConflict: "client_id,user_id" },
      );
    if (aErr) throw new Error(aErr.message);

    return { ok: true, email };
  });
