import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientLimitFor, firmLimitCatalogue } from "@/lib/firmPlans";

export type FirmSubscriptionRow = {
  tier: string | null;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  clientLimitOverride: number | null;
};

export type FirmSubscriptionPlanOption = {
  key: string;
  label: string;
  description: string;
  clientLimit: number;
  xeroOrgLimit: number;
  allowsMultiOrg: boolean;
  isFree: boolean;
  allowedTiers: string[];
  enabled: boolean;
};

export type FirmSubscriptionView = {
  firm: { id: string; name: string; isAlwaysFree: boolean };
  subscription: FirmSubscriptionRow;
  clientCount: number;
  clientLimit: number;
  plans: FirmSubscriptionPlanOption[];
  canManage: boolean;
  canChangePlan: boolean;
  isOwner: boolean;
  isSuperAdmin: boolean;
};

type Access = {
  isOwner: boolean;
  isMember: boolean;
  isSuperAdmin: boolean;
};

async function resolveAccess(supabase: any, userId: string, firmId: string): Promise<Access> {
  const [{ data: membership }, { data: superRow }] = await Promise.all([
    supabase
      .from("firm_members")
      .select("role")
      .eq("user_id", userId)
      .eq("firm_id", firmId)
      .eq("status", "active")
      .maybeSingle(),

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle(),
  ]);
  return {
    isOwner: membership?.role === "owner",
    isMember: !!membership,
    isSuperAdmin: !!superRow,
  };
}


/** Plan, status and available plan levels for one organisation. */
export const getFirmSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<FirmSubscriptionView> => {
    const access = await resolveAccess(context.supabase, context.userId, data.firmId);
    // Invariant 3: super_admin alone grants nothing. Active membership decides.
    // A read may also be reached through a live Path B support grant (read-only),
    // resolved by the database rule via platformStaffCanAccessFirm.
    let hasSupportGrant = false;
    if (!access.isMember) {
      const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
      hasSupportGrant = await platformStaffCanAccessFirm(context.userId, data.firmId);
      if (!hasSupportGrant) throw new Error("Forbidden");
    }

    const db: any = access.isMember
      ? context.supabase
      : (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    const [{ data: firm, error: firmError }, { data: sub }, { count }, { data: planRows }] =
      await Promise.all([
        db.from("firms").select("id, name, is_always_free").eq("id", data.firmId).maybeSingle(),
        db
          .from("subscriptions")
          .select(
            "tier, status, trial_ends_at, current_period_end, cancel_at_period_end, client_limit_override",
          )
          .eq("firm_id", data.firmId)
          .maybeSingle(),
        db.from("clients").select("id", { count: "exact", head: true }).eq("firm_id", data.firmId),
        db
          .from("plan_levels")
          .select(
            "key, label, description, client_limit, xero_org_limit, allows_multi_org, is_free, allowed_tiers, enabled, sort_order",
          )
          .eq("scope", "firm")
          .order("sort_order", { ascending: true }),
      ]);

    if (firmError) throw new Error(firmError.message);
    if (!firm) throw new Error("Organisation not found.");

    const s: any = sub ?? {};
    const isAlwaysFree = !!firm.is_always_free;
    const catalogue = firmLimitCatalogue(planRows ?? []);

    const plans: FirmSubscriptionPlanOption[] = ((planRows ?? []) as any[])
      .filter((p) => p.enabled || p.key === s.tier)
      .map((p) => ({
        key: p.key,
        label: p.label,
        description: p.description ?? "",
        clientLimit: p.client_limit ?? 0,
        xeroOrgLimit: p.xero_org_limit ?? p.client_limit ?? 0,
        allowsMultiOrg: !!p.allows_multi_org,
        isFree: !!p.is_free,
        allowedTiers: p.allowed_tiers ?? [],
        enabled: !!p.enabled,
      }));

    return {
      firm: { id: firm.id, name: firm.name, isAlwaysFree },
      subscription: {
        tier: s.tier ?? null,
        status: s.status ?? null,
        trialEndsAt: s.trial_ends_at ?? null,
        currentPeriodEnd: s.current_period_end ?? null,
        cancelAtPeriodEnd: !!s.cancel_at_period_end,
        clientLimitOverride: s.client_limit_override ?? null,
      },
      clientCount: count ?? 0,
      clientLimit: clientLimitFor(s.tier, isAlwaysFree, {
        override: s.client_limit_override ?? null,
        catalogue,
      }),
      plans,
      canManage: access.isOwner || access.isSuperAdmin,
      // Plan switching is super-admin only until a real payment path exists.
      canChangePlan: access.isSuperAdmin,
      isOwner: access.isOwner,
      isSuperAdmin: access.isSuperAdmin,
    };
  });

/** Super admin switches the organisation onto another plan level. */
export const changeFirmPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; planKey: string }) => i)
  .handler(async ({ data, context }): Promise<{ ok: true; tier: string }> => {
    // Authorisation, limits, status preservation and the audit row all live in
    // public.change_firm_plan — this is only a call site.
    const { error } = await context.supabase.rpc("change_firm_plan", {
      _firm_id: data.firmId,
      _plan_key: data.planKey,
    });
    if (error) {
      if (error.message.includes("NO_ACCESS")) {
        throw new Error("Only Positive Traction can change an organisation's plan.");
      }
      throw new Error(error.message);
    }

    return { ok: true, tier: data.planKey };
  });


/** Owner (or super admin) cancels at period end, or resumes a pending cancellation. */
export const setFirmCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; cancel: boolean }) => i)
  .handler(async ({ data, context }): Promise<{ ok: true; endsAt: string | null }> => {
    const access = await resolveAccess(context.supabase, context.userId, data.firmId);
    if (!access.isOwner && !access.isSuperAdmin) {
      throw new Error("Only the organisation owner can cancel the subscription.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id, status, current_period_end")
      .eq("firm_id", data.firmId)
      .maybeSingle();
    if (!existing) throw new Error("This organisation has no subscription to change.");

    const endMs = existing.current_period_end
      ? new Date(existing.current_period_end).getTime()
      : null;
    const lapsed = endMs != null && endMs <= Date.now();

    const patch: Record<string, unknown> = {
      cancel_at_period_end: data.cancel,
      updated_at: new Date().toISOString(),
    };
    if (data.cancel && (lapsed || endMs == null)) {
      // Nothing left to run out — end it now.
      patch.status = "canceled";
    } else if (!data.cancel && existing.status === "canceled") {
      patch.status = "active";
    }

    const { error } = await admin.from("subscriptions").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: context.userId,
      firmId: data.firmId,
      action: data.cancel ? "subscription_cancelled" : "subscription_resumed",
      targetType: "firm",
      targetId: data.firmId,
      meta: { ends_at: existing.current_period_end ?? null, by_super_admin: !access.isOwner },
    });

    return { ok: true, endsAt: existing.current_period_end ?? null };
  });
