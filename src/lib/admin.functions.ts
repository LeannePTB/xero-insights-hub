import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, _userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", _userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function logAudit(action: string, targetType: string, targetId: string, actorUserId: string, meta: Record<string, any>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta,
  });
}

function validatePassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new Error("Password must include at least one letter and one number.");
}

export const adminRenameFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const name = data.name.trim();
    if (name.length < 2 || name.length > 120) {
      throw new Error("Business name must be between 2 and 120 characters.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("firms").select("name").eq("id", data.firmId).maybeSingle();
    const { error } = await (supabaseAdmin as any)
      .from("firms").update({ name }).eq("id", data.firmId);
    if (error) throw new Error(error.message);
    await logAudit("firm_renamed_by_admin", "firm", data.firmId, context.userId, {
      firm_id: data.firmId, old_name: prev?.name ?? null, new_name: name,
    });
    return { ok: true };
  });

export const listFirmsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_firm_overview")
      .select("*")
      .order("firm_created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // recent_error_count in the view still counts audit_log, which no longer
    // receives Xero telemetry. Recompute from xero_api_errors (last 7 days)
    // so the number matches the drill-down sheet exactly.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: errRows } = await context.supabase
      .from("xero_api_errors")
      .select("firm_id, occurrences")
      .gte("last_seen", since);
    const counts = new Map<string, number>();
    for (const r of (errRows ?? []) as any[]) {
      if (!r.firm_id) continue;
      counts.set(r.firm_id, (counts.get(r.firm_id) ?? 0) + (r.occurrences ?? 0));
    }

    const firms = (data ?? []).map((f: any) => ({
      ...f,
      recent_error_count: counts.get(f.firm_id) ?? 0,
    }));
    return { firms };
  });


export const getFirmAuditAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: events, error } = await context.supabase
      .from("audit_log")
      .select("id, action, target_type, target_id, actor_user_id, meta, at")
      .or(`target_id.eq.${data.firmId},meta->>firm_id.eq.${data.firmId}`)
      .order("at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });

export const getFirmDetailAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: firm, error: fErr } = await supabaseAdmin
      .from("firms")
      .select("id, name, owner_user_id, is_always_free, created_at")
      .eq("id", data.firmId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!firm) throw new Error("Organisation not found");

    const { data: members } = await supabaseAdmin
      .from("firm_members")
      .select("id, user_id, role, created_at")
      .eq("firm_id", data.firmId)
      .order("created_at", { ascending: true });

    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, display_name").in("id", userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Pull last_sign_in_at for each member
    const membersWithAuth = await Promise.all(
      (members ?? []).map(async (m) => {
        const { data: u } = await (supabaseAdmin as any).auth.admin.getUserById(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: profileMap.get(m.user_id)?.email ?? u?.user?.email ?? null,
          display_name: profileMap.get(m.user_id)?.display_name ?? null,
          last_sign_in_at: u?.user?.last_sign_in_at ?? null,
          email_confirmed_at: u?.user?.email_confirmed_at ?? null,
        };
      }),
    );

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("firm_id", data.firmId)
      .maybeSingle();

    return { firm, members: membersWithAuth, subscription, billing: [] as any[] };

  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; firmId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await (supabaseAdmin as any).auth.admin.getUserById(data.userId);
    if (error || !u?.user?.email) throw new Error("User not found");
    const email = u.user.email as string;

    const { error: rErr } = await (supabaseAdmin as any).auth.resetPasswordForEmail(email, {
      redirectTo: "https://tractionadvisory.com.au/set-password",
    });
    if (rErr) throw new Error(rErr.message);

    await logAudit("password_reset_sent", "user", data.userId, context.userId, {
      firm_id: data.firmId,
      email,
    });
    return { ok: true, email };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; firmId: string; newPassword: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    validatePassword(data.newPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    await logAudit("password_set_by_admin", "user", data.userId, context.userId, {
      firm_id: data.firmId,
    });
    return { ok: true };
  });

export const adminUpdateUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; firmId: string; newEmail: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const newEmail = data.newEmail.trim().toLowerCase();
    if (!newEmail.includes("@") || newEmail.length > 254) throw new Error("Invalid email address.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: old } = await (supabaseAdmin as any).auth.admin.getUserById(data.userId);
    const oldEmail = old?.user?.email ?? null;

    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(data.userId, {
      email: newEmail,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("profiles").update({ email: newEmail }).eq("id", data.userId);
    await logAudit("email_changed_by_admin", "user", data.userId, context.userId, {
      firm_id: data.firmId,
      old_email: oldEmail,
      new_email: newEmail,
    });
    return { ok: true };
  });

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      firmId: string;
      tier?: string | null;
      status?: string | null;
      trial_ends_at?: string | null;
      current_period_end?: string | null;
      cancel_at_period_end?: boolean | null;
      is_always_free?: boolean | null;
      client_limit_override?: number | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const subPatch: Record<string, any> = {};
    for (const k of ["tier", "status", "trial_ends_at", "current_period_end", "cancel_at_period_end", "client_limit_override"] as const) {
      if (data[k] !== undefined) subPatch[k] = data[k];
    }


    if (Object.keys(subPatch).length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("firm_id", data.firmId)
        .maybeSingle();
      if (existing) {
        const { error } = await (supabaseAdmin as any)
          .from("subscriptions")
          .update(subPatch)
          .eq("firm_id", data.firmId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabaseAdmin as any)
          .from("subscriptions")
          .insert({ firm_id: data.firmId, ...subPatch });
        if (error) throw new Error(error.message);
      }
    }

    if (data.is_always_free !== undefined && data.is_always_free !== null) {
      const { error } = await (supabaseAdmin as any)
        .from("firms")
        .update({ is_always_free: data.is_always_free })
        .eq("id", data.firmId);
      if (error) throw new Error(error.message);
    }

    await logAudit("subscription_updated_by_admin", "firm", data.firmId, context.userId, {
      firm_id: data.firmId,
      changes: { ...subPatch, is_always_free: data.is_always_free },
    });
    return { ok: true };
  });

/**
 * Super admin joins/leaves an organisation as staff.
 * Membership grants client-data access automatically (see support-access.server.ts).
 */
export const adminSetSelfFirmMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; join: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.join) {
      const { error } = await (supabaseAdmin as any)
        .from("firm_members")
        .upsert(
          { firm_id: data.firmId, user_id: context.userId, role: "staff" },
          { onConflict: "firm_id,user_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabaseAdmin as any)
        .from("firm_members")
        .delete()
        .eq("firm_id", data.firmId)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }

    await logAudit(
      data.join ? "platform_staff_joined_firm" : "platform_staff_left_firm",
      "firm",
      data.firmId,
      context.userId,
      { firm_id: data.firmId },
    );
    return { ok: true, member: data.join };
  });

/**
 * Toggle the organisation-level consolidation add-on.
 *
 * Independent of the plan (capacity) and of client dashboard tiers: it gates
 * the cross-client consolidation tools. Super admin only, always audited.
 */
export const adminSetFirmConsolidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("id, consolidation_enabled")
      .eq("firm_id", data.firmId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing)
      throw new Error("This organisation has no plan yet — assign a plan before enabling add-ons.");

    const from = !!existing.consolidation_enabled;
    if (from !== data.enabled) {
      const { error } = await (supabaseAdmin as any)
        .from("subscriptions")
        .update({ consolidation_enabled: data.enabled })
        .eq("firm_id", data.firmId);
      if (error) throw new Error(error.message);

      await logAudit("firm_consolidation_addon_changed", "firm", data.firmId, context.userId, {
        firm_id: data.firmId,
        from,
        to: data.enabled,
      });
    }

    return { ok: true, enabled: data.enabled };
  });

/**
 * Toggle "Widgets in testing" (WIP) for one organisation.
 *
 * WIP is additive: public.client_allowed_widgets adds the plan_levels row
 * scope='dashboard', key='wip' on top of each client's normal tier when
 * public.firm_has_wip is true. Nothing here re-derives that.
 *
 * Super admin only — it exposes unfinished features to real financial data,
 * so an organisation owner must not be able to switch it on. Always audited.
 */
export const adminSetFirmWip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("id, wip_enabled")
      .eq("firm_id", data.firmId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing)
      throw new Error("This organisation has no plan yet — assign a plan before enabling add-ons.");

    const from = !!existing.wip_enabled;
    if (from !== data.enabled) {
      const { error } = await (supabaseAdmin as any)
        .from("subscriptions")
        .update({ wip_enabled: data.enabled })
        .eq("firm_id", data.firmId);
      if (error) throw new Error(error.message);

      await logAudit("firm_wip_access_changed", "firm", data.firmId, context.userId, {
        firm_id: data.firmId,
        from,
        to: data.enabled,
      });
    }

    return { ok: true, enabled: data.enabled };
  });

/**
 * Read-only view of what is in testing: the WIP widget list and which
 * organisations currently have early access. Super admin only.
 */
export const getWipOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: level } = await (supabaseAdmin as any)
      .from("plan_levels")
      .select("key, label, widgets, enabled")
      .eq("scope", "dashboard")
      .eq("key", "wip")
      .maybeSingle();

    const { data: subs } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("firm_id, wip_enabled")
      .eq("wip_enabled", true);

    const firmIds = ((subs ?? []) as any[]).map((s) => s.firm_id).filter(Boolean);
    let organisations: { id: string; name: string }[] = [];
    if (firmIds.length) {
      const { data: firms } = await (supabaseAdmin as any)
        .from("firms")
        .select("id, name")
        .in("id", firmIds);
      organisations = ((firms ?? []) as any[]).map((f) => ({ id: f.id, name: f.name }));
      organisations.sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      enabled: (level as any)?.enabled !== false,
      label: ((level as any)?.label as string | undefined) ?? "In testing",
      widgets: (((level as any)?.widgets ?? []) as string[]),
      organisations,
    };
  });
