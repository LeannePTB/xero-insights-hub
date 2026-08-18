import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_TIERS, type DashboardTier } from "@/lib/tiers";

// Entitlement (what a client may see) is deliberately separate from access
// control (who may see the client). Nothing in this file widens visibility.

type SubRow = {
  id: string;
  client_id: string;
  subscription_type: string;
  status: string;
  plan_name: string | null;
  dashboard_tier: string;
  trial_end: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  promotion_code: string | null;
  coupon_id: string | null;
  comp_reason: string | null;
  comped_at: string | null;
};

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Super admins only.");
}

/** Effective entitlement plus, for staff only, the billing record behind it. */
export const getClientBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { clientEntitlement } = await import("@/lib/entitlement.server");
    const entitlement = await clientEntitlement(context.supabase, data.clientId);

    // RLS decides whether the caller may see Stripe identifiers at all —
    // invited client viewers get the entitlement only.
    const { data: sub } = await (context.supabase as any)
      .from("client_subscriptions")
      .select(
        "id, client_id, subscription_type, status, plan_name, dashboard_tier, trial_end, current_period_end, past_due_since, promotion_code, coupon_id, comp_reason, comped_at",
      )
      .eq("client_id", data.clientId)
      .maybeSingle();

    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();

    return {
      entitlement,
      subscription: (sub ?? null) as SubRow | null,
      isSuperAdmin: Boolean(roleRow),
    };
  });

async function currentSub(clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("client_subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return data as SubRow | null;
}

async function firmIdFor(clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  return (data?.firm_id as string | null) ?? null;
}

/**
 * Comp a client onto free Standard, or remove the comp.
 * Super admin only (also enforced by RLS) and always audited — comping is a
 * revenue decision.
 */
export const setClientComp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; comped: boolean; reason: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const reason = (data.reason ?? "").trim();
    if (reason.length < 3) throw new Error("A short reason is required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await currentSub(data.clientId);

    const next = data.comped
      ? {
          client_id: data.clientId,
          subscription_type: "free_forever",
          status: "free_forever",
          dashboard_tier: "basic",
          plan_name: "Standard (comped)",
          trial_end: null,
          comp_reason: reason,
          comped_by: context.userId,
          comped_at: new Date().toISOString(),
        }
      : {
          client_id: data.clientId,
          subscription_type: "paid",
          status: "cancelled",
          dashboard_tier: before?.dashboard_tier ?? "basic",
          plan_name: before?.plan_name ?? null,
          comp_reason: reason,
          comped_by: context.userId,
          comped_at: null,
        };

    const { error } = await (supabaseAdmin as any)
      .from("client_subscriptions")
      .upsert(next, { onConflict: "client_id" });
    if (error) throw new Error(error.message);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: context.userId,
      firmId: await firmIdFor(data.clientId),
      action: data.comped ? "client_comp_granted" : "client_comp_removed",
      targetType: "client",
      targetId: data.clientId,
      meta: {
        reason,
        previous: before
          ? { type: before.subscription_type, status: before.status, tier: before.dashboard_tier }
          : null,
        next: { type: next.subscription_type, status: next.status, tier: next.dashboard_tier },
      },
    });

    return { ok: true };
  });

/** Start or end a trial of a higher dashboard. Super admin only, audited. */
export const setClientTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { clientId: string; tier: DashboardTier | null; days?: number; reason: string }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const reason = (data.reason ?? "").trim();
    if (reason.length < 3) throw new Error("A short reason is required.");
    if (data.tier && !(ALL_TIERS as string[]).includes(data.tier)) {
      throw new Error("Unknown dashboard level.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await currentSub(data.clientId);

    const days = Math.min(Math.max(data.days ?? 30, 1), 120);
    const trialEnd = data.tier
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const next = data.tier
      ? {
          client_id: data.clientId,
          subscription_type: "trial",
          status: "trialing",
          dashboard_tier: data.tier,
          trial_end: trialEnd,
          plan_name: before?.plan_name ?? null,
        }
      : {
          client_id: data.clientId,
          subscription_type: "paid",
          status: "cancelled",
          dashboard_tier: "basic",
          trial_end: null,
          plan_name: before?.plan_name ?? null,
        };

    const { error } = await (supabaseAdmin as any)
      .from("client_subscriptions")
      .upsert(next, { onConflict: "client_id" });
    if (error) throw new Error(error.message);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: context.userId,
      firmId: await firmIdFor(data.clientId),
      action: data.tier ? "client_trial_started" : "client_trial_ended",
      targetType: "client",
      targetId: data.clientId,
      meta: {
        reason,
        previous: before
          ? {
              type: before.subscription_type,
              status: before.status,
              tier: before.dashboard_tier,
              trial_end: before.trial_end,
            }
          : null,
        next: { type: next.subscription_type, status: next.status, tier: next.dashboard_tier, trial_end: trialEnd },
      },
    });

    return { ok: true, trialEnd };
  });

/**
 * Set a client's dashboard tier (Standard / Advisory / Multi company).
 *
 * Written through the caller's session so RLS decides who may change it —
 * organisation staff for their own clients, plus super admins. Absence of a
 * row correctly means Standard, so we never create one just to store `basic`.
 */
export const setClientDashboardTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tier: DashboardTier; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(ALL_TIERS as string[]).includes(data.tier)) throw new Error("Unknown dashboard tier.");
    const reason = (data.reason ?? "").trim();

    const supabase = context.supabase as any;
    const { data: before } = await supabase
      .from("client_subscriptions")
      .select("id, subscription_type, status, dashboard_tier")
      .eq("client_id", data.clientId)
      .maybeSingle();

    if (!before && data.tier === "basic") {
      // Nothing to store: no row already resolves to Standard.
      return { ok: true, tier: "basic" as const };
    }

    if (before) {
      const { error } = await supabase
        .from("client_subscriptions")
        .update({ dashboard_tier: data.tier })
        .eq("client_id", data.clientId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_subscriptions").insert({
        client_id: data.clientId,
        dashboard_tier: data.tier,
        subscription_type: "paid",
        status: "active",
      });
      if (error) throw new Error(error.message);
    }

    const { data: client } = await supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: context.userId,
      firmId: (client?.firm_id as string | null) ?? null,
      action: "client_dashboard_tier_changed",
      targetType: "client",
      targetId: data.clientId,
      meta: {
        reason: reason || null,
        from: before?.dashboard_tier ?? null,
        to: data.tier,
      },
    });

    return { ok: true, tier: data.tier };
  });
