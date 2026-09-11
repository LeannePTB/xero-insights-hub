import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { ALL_TIERS, type DashboardTier } from "@/lib/tiers";
import { z } from "zod";

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


/** Effective entitlement plus, for staff only, the billing record behind it. */
export const getClientBilling = createServerFn({ method: "POST" })
  .middleware([requireAal2])
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



/**
 * Comp a client onto free Standard, or remove the comp.
 * Super admin only (also enforced by RLS) and always audited — comping is a
 * revenue decision.
 */
export const setClientComp = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; comped: boolean; reason: string }) => ({
    clientId: z.string().uuid().parse(i.clientId),
    comped: z.boolean().parse(i.comped),
    reason: z.string().trim().min(3).max(500).parse(i.reason),
  }))
  .handler(async ({ data, context }) => {
    // Super admin, reason and audit row are all enforced by the database
    // (public.set_client_comp). Nothing is decided here.
    const { error } = await (context.supabase as any).rpc("set_client_comp", {
      _client_id: data.clientId,
      _comped: data.comped,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Start or end a trial of a higher dashboard. Super admin only, audited. */
export const setClientTrial = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; tier: DashboardTier | null; days?: number; reason: string }) => ({
    clientId: z.string().uuid().parse(i.clientId),
    tier: i.tier == null ? null : (z.enum(ALL_TIERS as unknown as [string, ...string[]]).parse(i.tier) as DashboardTier),
    days: i.days == null ? null : z.number().int().min(1).max(120).parse(i.days),
    reason: z.string().trim().min(3).max(500).parse(i.reason),
  }))
  .handler(async ({ data, context }) => {
    const { data: trialEnd, error } = await (context.supabase as any).rpc("set_client_trial", {
      _client_id: data.clientId,
      _tier: data.tier,
      _days: data.days ?? 30,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true, trialEnd: (trialEnd as string | null) ?? null };
  });

/**
 * Set a client's dashboard tier (Standard / Advisory / Multi company).
 *
 * The rule lives in public.set_client_dashboard_tier: organisation members with
 * write access to the client, or a super admin, aal2, audited. Support grants
 * are read-only and never admitted. Absence of a row correctly means Standard,
 * so no row is created just to store `basic`.
 */
export const setClientDashboardTier = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; tier: DashboardTier; reason?: string }) => ({
    clientId: z.string().uuid().parse(i.clientId),
    tier: z.enum(ALL_TIERS as unknown as [string, ...string[]]).parse(i.tier) as DashboardTier,
    reason: i.reason == null ? null : z.string().trim().max(500).parse(i.reason),
  }))
  .handler(async ({ data, context }) => {
    const { data: tier, error } = await (context.supabase as any).rpc("set_client_dashboard_tier", {
      _client_id: data.clientId,
      _tier: data.tier,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true, tier: (tier as DashboardTier) ?? data.tier };
  });

/**
 * Set the dashboard tier for every client in an organisation.
 *
 * All authorisation, plan-permission checks, billed-client skipping and audit
 * writing live in `public.set_all_client_tiers` — this is a thin RPC wrapper
 * running as the caller, never as service_role.
 */
export const setAllClientTiers = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (i: { firmId: string; tier: DashboardTier; includeBilled?: boolean; reason: string }) => i,
  )
  .handler(async ({ data, context }) => {
    const reason = (data.reason ?? "").trim();
    if (reason.length < 3) throw new Error("A short reason is required.");

    const { data: rows, error } = await (context.supabase as any).rpc("set_all_client_tiers", {
      _firm_id: data.firmId,
      _tier: data.tier,
      _include_billed: !!data.includeBilled,
      _reason: reason,
    });
    if (error) {
      if (String(error.message).includes("PLAN_DOES_NOT_PERMIT_TIER"))
        throw new Error("This organisation's plan does not include that dashboard.");
      throw new Error(error.message);
    }

    const r = (Array.isArray(rows) ? rows[0] : rows) ?? {};
    return {
      changed: Number(r.changed ?? 0),
      skippedBilled: Number(r.skipped_billed ?? 0),
      unchanged: Number(r.unchanged ?? 0),
      tier: data.tier,
    };
  });
