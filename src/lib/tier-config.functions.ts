import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_TIERS, ALL_WIDGETS, DEFAULT_TIER_WIDGETS, defaultWidgetsFor, type DashboardTier, type WidgetKey } from "@/lib/tiers";

function sanitizeWidgets(widgets: string[]): WidgetKey[] {
  return widgets.filter((w): w is WidgetKey => (ALL_WIDGETS as string[]).includes(w));
}

async function assertAdvisor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["advisor", "super_admin", "firm_owner", "firm_staff"]);
  if (!data || data.length === 0) throw new Error("Advisor only.");
}


// Returns the platform default card list plus, optionally, the list for one
// client. Both are derived from the deny-list model: ceiling − exclusions.
export const listTierConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { tierCeilings, ceilingFor, fetchExclusions, ExclusionIndex, visibleWidgets } =
      await import("@/lib/widget-resolve.server");

    let firmId: string | null = null;
    if (data.clientId) {
      const { data: c } = await context.supabase
        .from("clients")
        .select("firm_id")
        .eq("id", data.clientId)
        .maybeSingle();
      firmId = ((c as any)?.firm_id as string | null) ?? null;
    }

    const ceilings = await tierCeilings(context.supabase);
    const rows = await fetchExclusions(context.supabase, {
      firmId,
      clientIds: data.clientId ? [data.clientId] : [],
    });
    const index = new ExclusionIndex(rows);

    const tierKeys = Array.from(new Set<string>(ceilings.size ? Array.from(ceilings.keys()) : [...ALL_TIERS]));

    const global = Object.fromEntries(
      tierKeys.map((t) => [t, visibleWidgets(ceilingFor(ceilings, t), index.base(t, null))]),
    ) as Record<DashboardTier, WidgetKey[]>;

    const client = data.clientId
      ? (Object.fromEntries(
          tierKeys.map((t) => [
            t,
            visibleWidgets(
              ceilingFor(ceilings, t),
              index.effective(t, { firmId, clientId: data.clientId }),
            ),
          ]),
        ) as Record<DashboardTier, WidgetKey[] | null>)
      : null;

    return { global, client };
  });

// Shared maths only: turn an allow-list into the exclusions for a tier.
async function exclusionsFor(
  supabase: Parameters<typeof assertAdvisor>[0],
  tier: DashboardTier,
  widgets: WidgetKey[],
) {
  const { tierCeilings, ceilingFor, sanitizeWidgets: keep } = await import(
    "@/lib/widget-resolve.server"
  );
  const ceilings = await tierCeilings(supabase);
  const ceiling = ceilingFor(ceilings, tier);
  const on = new Set(keep(widgets));
  return ceiling.filter((w) => !on.has(w));
}

/**
 * Platform default row (client_id IS NULL AND firm_id IS NULL).
 *
 * The template for organisations with no row of their own. This is the ONLY
 * code path that may write it, and it is reachable only from the platform
 * tier-catalogue screen. Organisation-level changes go through
 * public.set_org_widget_enabled (see setOrgWidget); the two never share a path.
 */
export const savePlatformTierWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tier: DashboardTier; widgets: WidgetKey[] }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const excluded = await exclusionsFor(context.supabase, data.tier, data.widgets);

    // Partial unique indexes rule out ON CONFLICT here, so select/update/insert.
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("tier_widget_config")
      .select("id")
      .eq("tier", data.tier)
      .is("client_id", null)
      .is("firm_id", null)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .update({ excluded_widgets: excluded })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .insert({ client_id: null, firm_id: null, tier: data.tier, excluded_widgets: excluded });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/**
 * One client's own exclusions (client_id set). Never touches the platform or
 * organisation rows. Passing widgets: null removes the override so the client
 * falls back to the organisation row, then the platform default.
 */
export const saveClientTierWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tier: DashboardTier; widgets: WidgetKey[] | null }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.widgets === null) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .delete()
        .eq("client_id", data.clientId)
        .eq("tier", data.tier);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Client-level overrides may only target tiers the organisation's plan includes.
    const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
    const planTiers = await allowedTiersForClient(data.clientId);
    if (planTiers && !planTiers.includes(data.tier)) {
      throw new Error("This tier is not included in the organisation's plan.");
    }

    const excluded = await exclusionsFor(context.supabase, data.tier, data.widgets);

    const { data: existing, error: findErr } = await supabaseAdmin
      .from("tier_widget_config")
      .select("id")
      .eq("tier", data.tier)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .update({ excluded_widgets: excluded })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .insert({
          client_id: data.clientId,
          firm_id: null,
          tier: data.tier,
          excluded_widgets: excluded,
        });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });



// Resolves the cards a client sees on a tier (ceiling − organisation/client exclusions).
export const getEffectiveWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const { tierCeilings, ceilingFor, fetchExclusions, ExclusionIndex, visibleWidgets } =
      await import("@/lib/widget-resolve.server");
    const { data: c } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const firmId = ((c as any)?.firm_id as string | null) ?? null;

    const ceilings = await tierCeilings(context.supabase);
    const index = new ExclusionIndex(
      await fetchExclusions(context.supabase, { firmId, clientIds: [data.clientId] }),
    );
    const widgets = visibleWidgets(
      ceilingFor(ceilings, data.tier),
      index.effective(data.tier, { firmId, clientId: data.clientId }),
    );
    return { widgets };
  });

/**
 * Organisation card matrix for the "Cards included by default" panel: one row
 * per dashboard tier the organisation's plan includes, showing the tier's plan
 * ceiling and which cards are currently excluded for this organisation.
 */
export const getOrgWidgetMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }) => {
    const { tierCeilings, fetchExclusions, ExclusionIndex, visibleWidgets } =
      await import("@/lib/widget-resolve.server");

    // Which dashboard tiers the organisation's plan includes.
    const { data: sub } = await (context.supabase as any)
      .from("subscriptions")
      .select("tier")
      .eq("firm_id", data.firmId)
      .maybeSingle();
    const { data: levels } = await (context.supabase as any)
      .from("plan_levels")
      .select("scope, key, label, widgets, allowed_tiers, enabled, sort_order")
      .order("sort_order", { ascending: true });
    const all = ((levels ?? []) as any[]).filter((l) => l.enabled !== false);
    const firmPlan = sub?.tier ? all.find((l) => l.scope === "firm" && l.key === sub.tier) : null;
    const allowed = ((firmPlan?.allowed_tiers ?? []) as string[]).filter(Boolean);
    const catalogue = all.filter((l) => l.scope === "dashboard");
    const { cumulativeDashboardLevels } = await import("@/lib/plan-tiers");
    const included = cumulativeDashboardLevels(catalogue as any[], allowed.length ? allowed : null);
    const usable = included.length ? included : catalogue.filter((l: any) => l.key === "basic");

    const ceilings = await tierCeilings(context.supabase);
    const index = new ExclusionIndex(await fetchExclusions(context.supabase, { firmId: data.firmId }));

    const { count } = await (context.supabase as any)
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", data.firmId);

    return {
      clientCount: count ?? 0,
      tiers: usable.map((l: any) => {
        const ceiling = ceilings.get(l.key as string) ?? [];
        const excluded = index.base(l.key as string, data.firmId);
        // What this tier would look like with no organisation row at all, so
        // the UI can name exactly what "follow the platform default" changes.
        const platformExcluded = index.base(l.key as string, null);
        return {
          key: l.key as string,
          label: l.label as string,
          ceiling,
          excluded: ceiling.filter((w) => excluded.includes(w)),
          platformExcluded: ceiling.filter((w) => platformExcluded.includes(w)),
          visible: visibleWidgets(ceiling, excluded),
          usesOrgRow: index.hasOrgRow(l.key as string, data.firmId),
        };
      }),
    };
  });

/**
 * Read-only: which organisations have their own card list for each tier.
 *
 * Organisation rows REPLACE the platform row, so a platform edit never reaches
 * them. The platform tier screen shows this so the detachment is visible at the
 * moment an edit is made. No write, no entitlement change.
 */
export const listOrgTierOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("tier_widget_config")
      .select("firm_id, tier")
      .is("client_id", null)
      .not("firm_id", "is", null);
    if (error) throw new Error(error.message);

    const firmIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.firm_id as string)));
    const names = new Map<string, string>();
    if (firmIds.length) {
      const { data: firms } = await (supabaseAdmin as any)
        .from("firms")
        .select("id, name")
        .in("id", firmIds);
      for (const f of (firms ?? []) as any[]) names.set(f.id as string, f.name as string);
    }

    const byTier: Record<string, { firmId: string; name: string }[]> = {};
    for (const r of (rows ?? []) as any[]) {
      const tier = r.tier as string;
      (byTier[tier] ??= []).push({
        firmId: r.firm_id as string,
        name: names.get(r.firm_id as string) ?? "Unknown organisation",
      });
    }
    for (const list of Object.values(byTier)) list.sort((a, b) => a.name.localeCompare(b.name));
    return { byTier };
  });

/**
 * Deletes ONE organisation's row for ONE tier, so the organisation follows the
 * platform default again. The only write added by this change, and only on an
 * explicit click. Nothing else is touched: no client rows, no plan, no
 * entitlement, no policy.
 */
export const resetOrgTierToPlatformDefault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; tier: string }) => i)
  .handler(async ({ data, context }) => {
    // Authorisation is the database's, not ours.
    const { data: canAccess, error: accessErr } = await (context.supabase as any).rpc(
      "user_can_access_firm",
      { _user_id: context.userId, _firm_id: data.firmId },
    );
    if (accessErr) throw new Error(accessErr.message);
    if (canAccess !== true) throw new Error("You don't have access to this organisation.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("tier_widget_config")
      .delete()
      .eq("firm_id", data.firmId)
      .eq("tier", data.tier)
      .is("client_id", null);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("audit_log").insert({
      actor_user_id: context.userId,
      firm_id: data.firmId,
      action: "org_widget_row_reset",
      target_type: "tier_widget_config",
      meta: { tier: data.tier },
    });

    return { ok: true };
  });


/**
 * Turns one card on or off for a whole organisation. The database RPC
 * authorises the caller, seeds the organisation row from the platform default,
 * clears the card from every client's own exclusions when enabling, and writes
 * its own audit row. Never write the table directly.
 */
export const setOrgWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; tier: string; widget: WidgetKey; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("set_org_widget_enabled", {
      _firm_id: data.firmId,
      _tier: data.tier,
      _widget: data.widget,
      _enabled: data.enabled,
    });
    if (error) {
      throw new Error(
        error.message?.includes("NO_ACCESS")
          ? "You don't have access to this organisation."
          : error.message,
      );
    }
    const first = Array.isArray(rows) ? rows[0] : rows;
    return { clientsAffected: Number(first?.clients_affected ?? 0) };
  });


// Global on/off per tier.
export const listTierSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tier_settings")
      .select("tier, enabled");
    if (error) throw new Error(error.message);
    const map = Object.fromEntries(ALL_TIERS.map((t) => [t, true])) as Record<string, boolean>;
    for (const r of data ?? []) map[r.tier as string] = !!r.enabled;
    return { enabled: map as Record<DashboardTier, boolean> };
  });

export const setTierEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tier: DashboardTier; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tier_settings")
      .upsert({ tier: data.tier, enabled: data.enabled }, { onConflict: "tier" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Returns the upgrade tiers (enabled globally, higher than current) along with
// the resolved widget list for each, and the firm contact email to request
// the upgrade from. Used to render upsell rows on the client dashboard.
export const getUpgradeOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; currentTier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    // tier_settings: enabled map
    const { data: settingsRows } = await context.supabase
      .from("tier_settings")
      .select("tier, enabled");
    const enabledMap = Object.fromEntries(ALL_TIERS.map((t) => [t, true])) as Record<DashboardTier, boolean>;
    for (const r of settingsRows ?? []) enabledMap[(r as any).tier as DashboardTier] = !!(r as any).enabled;

    // Resolved cards per tier: plan ceiling − organisation/client exclusions.
    const { tierCeilings, ceilingFor, fetchExclusions, ExclusionIndex, visibleWidgets } =
      await import("@/lib/widget-resolve.server");
    const { data: clientRow } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const upgradeFirmId = ((clientRow as any)?.firm_id as string | null) ?? null;
    const ceilings = await tierCeilings(context.supabase);
    const exIndex = new ExclusionIndex(
      await fetchExclusions(context.supabase, { firmId: upgradeFirmId, clientIds: [data.clientId] }),
    );
    const resolve = (t: DashboardTier): WidgetKey[] =>
      visibleWidgets(
        ceilingFor(ceilings, t),
        exIndex.effective(t, { firmId: upgradeFirmId, clientId: data.clientId }),
      );


    const currentWidgets = new Set<WidgetKey>(resolve(data.currentTier));

    // Tier order comes from the catalogue so custom steps (e.g. multi_10) rank
    // correctly instead of falling outside a hardcoded list.
    const { data: catRows } = await context.supabase
      .from("plan_levels")
      .select("key, label, description, xero_org_limit, allows_multi_org, enabled, sort_order")
      .eq("scope", "dashboard")
      .order("sort_order", { ascending: true });
    const catalogue = ((catRows ?? []) as any[]).filter((l) => l.enabled !== false);
    const order: string[] = catalogue.length ? catalogue.map((l) => l.key as string) : [...ALL_TIERS];
    const meta = new Map<string, any>(catalogue.map((l) => [l.key as string, l]));
    // Upgrades are offered relative to what the client is actually entitled to
    // today — a lapsed trial should immediately see the higher dashboards
    // offered again rather than being treated as if it still had them.
    const { clientEntitlement } = await import("@/lib/entitlement.server");
    const entitlement = await clientEntitlement(context.supabase, data.clientId);
    const entIdx = order.indexOf(entitlement.tier);
    const passedIdx = order.indexOf(data.currentTier);
    const currentIdx = entIdx >= 0 ? Math.min(passedIdx, entIdx) : passedIdx;


    // Only advertise tiers this organisation's plan actually includes.
    const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
    const planTiers = await allowedTiersForClient(data.clientId);

    const upgrades = order
      .map((tier, idx) => ({ tier, idx }))
      .filter(
        ({ tier, idx }) =>
          idx > currentIdx &&
          (enabledMap[tier as DashboardTier] ?? true) &&
          (!planTiers || planTiers.includes(tier)),
      )
      .map(({ tier }) => {
        const widgets = resolve(tier as DashboardTier);
        const extra = widgets.filter((w) => !currentWidgets.has(w));
        const m = meta.get(tier);
        return {
          tier,
          label: (m?.label as string | undefined) ?? null,
          description: (m?.description as string | undefined) ?? null,
          xeroFiles: (m?.xero_org_limit as number | undefined) ?? 1,
          allowsMultiOrg: !!m?.allows_multi_org,
          widgets,
          extraWidgets: extra,
        };
      })
      .filter((u) => u.extraWidgets.length > 0);

    // Firm contact email = firm owner's profile email (best-effort).
    let contactEmail: string | null = null;
    const { data: client } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const firmId = (client as any)?.firm_id as string | null | undefined;
    if (firmId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: firm } = await supabaseAdmin
        .from("firms")
        .select("owner_user_id")
        .eq("id", firmId)
        .maybeSingle();
      const ownerId = (firm as any)?.owner_user_id as string | undefined;
      if (ownerId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", ownerId)
          .maybeSingle();
        contactEmail = (profile as any)?.email ?? null;
      }
    }

    return { upgrades, contactEmail };
  });

// ---------------------------------------------------------------------------
// Per-client widget control.
// SINGLE SOURCE OF TRUTH: public.client_allowed_widgets(clientId). The database
// already intersects the organisation's plan, the dashboard tier catalogue, the
// client's entitlement and the tier_widget_config exclusions. Nothing here may
// re-derive or further narrow that list — the previous plan/tier/firm-default
// ceilings and the retired clients.dashboard_widgets allow-list silently held
// clients back on the Standard cards after a tier upgrade.
// Fail closed: an empty or errored lookup renders no cards.
// ---------------------------------------------------------------------------

export const getClientWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tierOverride?: DashboardTier | null }) => i)
  .handler(async ({ data, context }) => {
    const { clientAllowedWidgets } = await import("@/lib/widget-access.server");
    const allowedSet = new Set<string>(await clientAllowedWidgets(context.supabase, data.clientId));
    const availableWidgets = ALL_WIDGETS.filter((w) => allowedSet.has(w));

    // Cards still in testing, so the dashboard can badge them.
    const { data: clientRow } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const wipWidgets = await wipWidgetsForFirm(
      context.supabase,
      ((clientRow as any)?.firm_id as string | null) ?? null,
    );

    // Labels only — never a second source for the card list.
    const { data: levels } = await context.supabase
      .from("plan_levels")
      .select("key, label, widgets, sort_order, enabled")
      .eq("scope", "dashboard")
      .order("sort_order", { ascending: true });
    const catalogue = (levels ?? []).filter((l: any) => l.enabled !== false);

    const { clientEntitlement } = await import("@/lib/entitlement.server");
    const entitlement = await clientEntitlement(context.supabase, data.clientId);
    const entLevel: any = catalogue.find((l: any) => l.key === entitlement.tier);
    const planLabel = (entLevel?.label as string | undefined) ?? entitlement.tier;

    // "View as <tier>" preview renders that tier's catalogue list verbatim.
    if (data.tierOverride) {
      const lvl: any = catalogue.find((l: any) => l.key === data.tierOverride);
      const preview = lvl
        ? sanitizeWidgets((lvl.widgets ?? []) as string[])
        : defaultWidgetsFor(data.tierOverride);
      return {
        widgets: preview,
        availableWidgets,
        wipWidgets,
        configured: false,
        planLabel,
        highestTier: String(entitlement.tier),
        entitlement,
      };
    }

    return {
      widgets: availableWidgets,
      availableWidgets,
      wipWidgets,
      configured: false,
      planLabel,
      highestTier: String(entitlement.tier),
      entitlement,
    };
  });


export const saveClientWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; widgets: WidgetKey[] | null }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let value: string[] | null = null;
    if (data.widgets !== null) {
      const planTiers = await allowedTiersForClient(data.clientId);
      const { data: levels } = await supabaseAdmin
        .from("plan_levels")
        .select("key, widgets, enabled, sort_order")
        .eq("scope", "dashboard")
        .order("sort_order", { ascending: true });
      const { cumulativeDashboardLevels } = await import("@/lib/plan-tiers");
      const enabled = (levels ?? []).filter((l: any) => l.enabled !== false);
      const usable = cumulativeDashboardLevels(enabled as any[], planTiers);

      const allowed = new Set<WidgetKey>();
      for (const l of usable) for (const w of sanitizeWidgets(((l as any).widgets ?? []) as string[])) allowed.add(w);
      if (allowed.size === 0) for (const w of DEFAULT_TIER_WIDGETS.basic) allowed.add(w);
      value = sanitizeWidgets(data.widgets).filter((w) => allowed.has(w));
    }

    const { error } = await (supabaseAdmin as any)
      .from("clients")
      .update({ dashboard_widgets: value })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Read-only summary of what an organisation's plan includes: limits, dashboard
 * tiers, and the default card list new clients inherit.
 */
export const getFirmPlanSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: sub } = await (context.supabase as any)
      .from("subscriptions")
      .select("tier, client_limit_override")
      .eq("firm_id", data.firmId)
      .maybeSingle();
    const planKey = (sub?.tier as string | undefined) ?? null;

    const { data: levels } = await (context.supabase as any)
      .from("plan_levels")
      .select("scope, key, label, widgets, allowed_tiers, client_limit, xero_org_limit, allows_multi_org, sort_order, enabled")
      .order("sort_order", { ascending: true });
    const all = (levels ?? []) as any[];

    const firmPlan = planKey ? all.find((l) => l.scope === "firm" && l.key === planKey) : null;
    const allowed = ((firmPlan?.allowed_tiers ?? []) as string[]).filter(Boolean);
    const planTiers = allowed.length ? allowed : null;

    const catalogue = all.filter((l) => l.scope === "dashboard" && l.enabled !== false);
    const included = catalogue.filter((l) => !planTiers || planTiers.includes(l.key));
    const usable = included.length ? included : catalogue.filter((l) => l.key === "basic");

    const set = new Set<WidgetKey>();
    for (const l of usable) for (const w of sanitizeWidgets((l.widgets ?? []) as string[])) set.add(w);
    if (set.size === 0) for (const w of DEFAULT_TIER_WIDGETS.basic) set.add(w);

    // Organisation plans are 1 client : 1 Xero file, so the effective client
    // allowance (override included) is also the Xero file allowance and the
    // maximum number of files that can sit in a consolidation group.
    const override = (sub?.client_limit_override as number | undefined) ?? null;
    const baseClientLimit = (firmPlan?.client_limit as number | undefined) ?? null;
    const effectiveClientLimit = override ?? baseClientLimit;
    const supportsConsolidation = !!firmPlan?.allows_multi_org || (effectiveClientLimit ?? 1) > 1;

    const { data: firmRow } = await (context.supabase as any)
      .from("firms")
      .select("default_widgets")
      .eq("id", data.firmId)
      .maybeSingle();
    const firmDefaults = (firmRow?.default_widgets as string[] | null | undefined) ?? null;
    const availableWidgets = ALL_WIDGETS.filter((w) => set.has(w));
    const widgets = Array.isArray(firmDefaults)
      ? availableWidgets.filter((w) => firmDefaults.includes(w))
      : availableWidgets;

    return {
      planKey,
      planLabel: (firmPlan?.label as string | undefined) ?? null,
      clientLimit: effectiveClientLimit,
      xeroFileLimit: effectiveClientLimit,
      consolidationLimit: supportsConsolidation ? effectiveClientLimit : null,
      supportsConsolidation,
      allowsMultiOrg: !!firmPlan?.allows_multi_org,
      tiers: usable.map((l) => ({
        key: l.key as string,
        label: l.label as string,
        xeroFiles: (l.xero_org_limit as number | undefined) ?? 1,
        allowsMultiOrg: !!l.allows_multi_org,
      })),
      widgets,
      availableWidgets,
      configured: Array.isArray(firmDefaults),
    };
  });

/**
 * Sets the organisation-wide default card list and applies it to every client
 * in the organisation. Unticking a card turns it off for all clients; ticking
 * one back on does not override a client's own "off" setting.
 */
export const saveFirmDefaultWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; widgets: WidgetKey[] }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Membership check unless platform admin.
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) {
      const { data: member } = await context.supabase
        .from("firm_members")
        .select("id")
        .eq("firm_id", data.firmId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!member) throw new Error("Not a member of this organisation.");
    }

    const selected = sanitizeWidgets(data.widgets);

    const { error: firmErr } = await (supabaseAdmin as any)
      .from("firms")
      .update({ default_widgets: selected })
      .eq("id", data.firmId);
    if (firmErr) throw new Error(firmErr.message);

    // Apply to existing clients: intersect each client's effective list.
    const { data: clients } = await (supabaseAdmin as any)
      .from("clients")
      .select("id, dashboard_widgets")
      .eq("firm_id", data.firmId);

    for (const c of (clients ?? []) as any[]) {
      const current: string[] = Array.isArray(c.dashboard_widgets)
        ? c.dashboard_widgets
        : selected;
      const next = sanitizeWidgets(current).filter((w) => selected.includes(w));
      await (supabaseAdmin as any)
        .from("clients")
        .update({ dashboard_widgets: next })
        .eq("id", c.id);
    }

    return { ok: true, clientsUpdated: (clients ?? []).length };
  });


// ---------------------------------------------------------------------------
// Per-client card toggles.
// Reads: public.client_allowed_widgets (what the client actually sees) plus
// the tier ceiling and the organisation/client exclusion rows, purely so the
// UI can explain WHY a card is off. Writes go through
// public.set_client_widget_enabled — never tier_widget_config directly, and
// never the retired clients.dashboard_widgets.
// Resolution is platform -> organisation -> client, each only ADDING
// exclusions, so a client-level switch can never grant a card back that the
// organisation has switched off.
// ---------------------------------------------------------------------------

export const getClientWidgetMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { tierCeilings, ceilingFor, fetchExclusions, ExclusionIndex } =
      await import("@/lib/widget-resolve.server");
    const { clientEntitlement } = await import("@/lib/entitlement.server");
    const { clientAllowedWidgets } = await import("@/lib/widget-access.server");

    const { data: c } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const firmId = ((c as any)?.firm_id as string | null) ?? null;

    const entitlement = await clientEntitlement(context.supabase, data.clientId);
    const tier = String(entitlement.tier);

    const ceilings = await tierCeilings(context.supabase);
    const ceiling = ceilingFor(ceilings, tier);

    const index = new ExclusionIndex(
      await fetchExclusions(context.supabase, { firmId, clientIds: [data.clientId] }),
    );
    const orgExcluded = new Set(index.base(tier, firmId));
    const allowed = new Set<string>(await clientAllowedWidgets(context.supabase, data.clientId));

    // Cards in testing sit outside the tier ceiling but are visible to the
    // client, so they must be listed here too — otherwise there is no way to
    // switch one off for a single client.
    const wip = await wipWidgetsForFirm(context.supabase, firmId);
    const listed = [...ceiling, ...wip.filter((w) => !ceiling.includes(w as any))] as typeof ceiling;

    const rows = listed.map((w) => {
      const on = allowed.has(w);
      const orgOff = orgExcluded.has(w);
      return {
        widget: w,
        on,
        wip: wip.includes(w as string),
        // organisation exclusions win; the client switch cannot override them.
        reason: on ? "on" : orgOff ? "organisation" : "client",
      };
    });

    return { tier, rows };
  });

export const setClientWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; widget: WidgetKey; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("set_client_widget_enabled", {
      _client_id: data.clientId,
      _widget: data.widget,
      _enabled: data.enabled,
    });
    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("NOT_IN_TIER")) throw new Error("NOT_IN_TIER");
      if (msg.includes("NO_ACCESS")) throw new Error("You don't have access to this client.");
      throw new Error(msg || "Could not change this card.");
    }
    const first = Array.isArray(rows) ? rows[0] : rows;
    return {
      tier: String((first as any)?.effective_tier ?? ""),
      isEnabled: (first as any)?.is_enabled === true,
    };
  });


/**
 * The widget keys currently in testing for one client's organisation.
 *
 * Presentation support only: the entitlement itself is decided by
 * public.client_allowed_widgets / public.firm_has_wip, which already add the
 * WIP set on top of the client's tier. This just names which of the cards a
 * client can see are experimental, so the dashboard can badge them.
 */
async function wipWidgetsForFirm(supabase: any, firmId: string | null): Promise<string[]> {
  if (!firmId) return [];
  try {
    const { data: on, error } = await supabase.rpc("firm_has_wip", { _firm_id: firmId });
    if (error || on !== true) return [];
    const { data: level } = await supabase
      .from("plan_levels")
      .select("widgets, enabled")
      .eq("scope", "dashboard")
      .eq("key", "wip")
      .maybeSingle();
    if (!level || (level as any).enabled === false) return [];
    return (((level as any).widgets ?? []) as string[]).filter(Boolean);
  } catch {
    return [];
  }
}
