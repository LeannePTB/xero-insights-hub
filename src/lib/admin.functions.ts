import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { siteUrl } from "@/lib/site-origin";
import { assertSuperAdminDb } from "@/lib/auth/super-admin.server";


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
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
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
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    await assertSuperAdminDb(context.supabase);
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
  .middleware([requireAal2])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
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
  .middleware([requireAal2])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: firm, error: fErr } = await supabaseAdmin
      .from("firms")
      .select("id, name, owner_user_id, is_always_free, created_at")
      .eq("id", data.firmId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!firm) throw new Error("Organisation not found");

    // Membership is Path C metadata and the list comes from the database
    // (`public.admin_firm_members` re-checks aal2 + super admin and returns the
    // verified auth.users email), never from a membership read decided here.
    const { data: memberRows, error: mErr } = await (context.supabase as any).rpc(
      "admin_firm_members",
      { _firm_id: data.firmId },
    );
    if (mErr) throw new Error(mErr.message);
    const members = (memberRows ?? []) as Array<{
      id: string;
      user_id: string;
      role: string;
      created_at: string;
      email: string | null;
      display_name: string | null;
    }>;


    // Pull last_sign_in_at for each member
    const membersWithAuth = await Promise.all(
      (members ?? []).map(async (m) => {
        const { data: u } = await (supabaseAdmin as any).auth.admin.getUserById(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: emailById.get(m.user_id) ?? u?.user?.email ?? null,
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
  .middleware([requireAal2])
  .inputValidator((i: { userId: string; firmId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await (supabaseAdmin as any).auth.admin.getUserById(data.userId);
    if (error || !u?.user?.email) throw new Error("User not found");
    const email = u.user.email as string;

    const { error: rErr } = await (supabaseAdmin as any).auth.resetPasswordForEmail(email, {
      redirectTo: siteUrl("/set-password"),
    });
    if (rErr) throw new Error(rErr.message);

    await logAudit("password_reset_sent", "user", data.userId, context.userId, {
      firm_id: data.firmId,
      email,
    });
    return { ok: true, email };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { userId: string; firmId: string; newPassword: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
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
  .middleware([requireAal2])
  .inputValidator((i: { userId: string; firmId: string; newEmail: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
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
  .middleware([requireAal2])
  .inputValidator(
    (i: {
      firmId: string;
      tier?: string | null;
      status?: string | null;
      trial_ends_at?: string | null;
      current_period_end?: string | null;
      cancel_at_period_end?: boolean | null;
      is_always_free?: boolean | null;
      always_free_reason?: string | null;
      client_limit_override?: number | null;
    }) => ({
      ...i,
      always_free_reason:
        i.always_free_reason == null
          ? null
          : z.string().trim().min(3).max(500).parse(i.always_free_reason),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
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
      // Only public.set_firm_always_free may change this flag: it re-checks aal2
      // and super admin, refuses TRUE on anything but the practice organisation,
      // and writes its own audit row (Spec §4).
      if (!data.always_free_reason) throw new Error("A reason is required to change always free.");
      const { error } = await (context.supabase as any).rpc("set_firm_always_free", {
        _firm_id: data.firmId,
        _value: data.is_always_free,
        _reason: data.always_free_reason,
      });
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
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; join: boolean }) =>
    z.object({ firmId: z.string().uuid(), join: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // The rule lives in the database (backlog 30): aal2 + super admin, joining
    // only while the organisation is still owned by Positive Traction, the row
    // reactivated to 'active', and the audit row written there. Runs as the
    // caller so nothing is decided here.
    const { error } = await (context.supabase as any).rpc("admin_set_self_firm_membership", {
      _firm_id: data.firmId,
      _join: data.join,
    });
    if (error) throw new Error(error.message);
    return { ok: true, member: data.join };
  });

/**
 * Toggle the organisation-level consolidation add-on.
 *
 * Independent of the plan (capacity) and of client dashboard tiers: it gates
 * the cross-client consolidation tools. Super admin only, always audited.
 */
/**
 * Set one boolean add-on flag on an organisation's subscription and PROVE it landed.
 *
 * The write is never skipped on the strength of a prior read: it always runs,
 * returns the affected row via .select(), and the caller only sees success when
 * exactly one row came back carrying the requested value. Zero rows affected is
 * an error, not a success — a toggle that says "saved" without saving is worse
 * than one that errors.
 */
async function setSubscriptionFlag(
  firmId: string,
  column: "consolidation_enabled",
  enabled: boolean,
  traceId?: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: readErr } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select(`id, ${column}`)
    .eq("firm_id", firmId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!existing)
    throw new Error("This organisation has no plan yet — assign a plan before enabling add-ons.");

  const from = !!existing[column];

  const { data: rows, error } = await (supabaseAdmin as any)
    .from("subscriptions")
    .update({ [column]: enabled })
    .eq("id", existing.id)
    .select(`id, ${column}`);
  console.info("[admin-subscription-flag] update-result", {
    traceId,
    firmId,
    subscriptionId: existing.id,
    column,
    enabled,
    rows,
    error: error ? { message: error.message, code: error.code } : null,
  });
  if (error) throw new Error(error.message);

  const updated = (rows ?? []) as any[];
  if (updated.length !== 1 || !!updated[0]?.[column] !== enabled) {
    console.error("[subscription-flag] write not confirmed", {
      firmId,
      column,
      enabled,
      rowsAffected: updated.length,
    });
    throw new Error(
      "The change was not saved — the database did not confirm the update. Nothing has changed.",
    );
  }

  return { from, changed: from !== enabled };
}

export const adminSetFirmConsolidation = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
    const enabled = data.enabled === true;

    const { from, changed } = await setSubscriptionFlag(
      data.firmId,
      "consolidation_enabled",
      enabled,
    );

    if (changed) {
      await logAudit("firm_consolidation_addon_changed", "firm", data.firmId, context.userId, {
        firm_id: data.firmId,
        from,
        to: enabled,
      });
    }

    return { ok: true, enabled };
  });

