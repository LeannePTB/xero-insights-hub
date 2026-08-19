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

// Saves an allow-list by storing its complement as exclusions for that scope.
export const saveTierWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string | null; tier: DashboardTier; widgets: WidgetKey[] | null }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // null widgets on a client override = remove override (fall back to the
    // organisation row, then the platform default).
    if (data.clientId && data.widgets === null) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .delete()
        .eq("client_id", data.clientId)
        .eq("tier", data.tier);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Client-level overrides may only target tiers the organisation's plan includes.
    if (data.clientId) {
      const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
      const planTiers = await allowedTiersForClient(data.clientId);
      if (planTiers && !planTiers.includes(data.tier)) {
        throw new Error("This tier is not included in the organisation's plan.");
      }
    }

    const { tierCeilings, ceilingFor, sanitizeWidgets: keep } = await import("@/lib/widget-resolve.server");
    const ceilings = await tierCeilings(context.supabase);
    const ceiling = ceilingFor(ceilings, data.tier);
    const on = new Set(keep(data.widgets ?? []));
    const excluded = ceiling.filter((w) => !on.has(w));

    // Unique indexes on this table are partial, so ON CONFLICT can't be used
    // for every scope — do select/update/insert.
    let query = supabaseAdmin
      .from("tier_widget_config")
      .select("id")
      .eq("tier", data.tier);
    query =
      data.clientId === null
        ? query.is("client_id", null).is("firm_id", null)
        : query.eq("client_id", data.clientId);
    const { data: existing, error: findErr } = await query.maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .update({ excluded_widgets: excluded })
        .eq("id", (existing as any).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .insert({ client_id: data.clientId, firm_id: null, tier: data.tier, excluded_widgets: excluded });
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
        return {
          key: l.key as string,
          label: l.label as string,
          ceiling,
          excluded: ceiling.filter((w) => excluded.includes(w)),
          visible: visibleWidgets(ceiling, excluded),
          usesOrgRow: index.hasOrgRow(l.key as string, data.firmId),
        };
      }),
    };
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
    const { data: rows, error } = await (context.supabase as any).rpc("set_org_widget_enabled", {
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
    const overridesCleared = Number((first as any)?.clients_affected ?? 0);

    const { count } = await (context.supabase as any)
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", data.firmId);

    return { overridesCleared, clientCount: count ?? 0 };
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
// The organisation's plan sets the ceiling (which tiers it may use → which
// widgets exist for it); each client then gets its own explicit widget list.
// ---------------------------------------------------------------------------

export const getClientWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tierOverride?: DashboardTier | null }) => i)
  .handler(async ({ data, context }) => {
    const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
    const planTiers = await allowedTiersForClient(data.clientId);

    // Dashboard tier catalogue (super-admin editable, may contain custom keys).
    const { data: levels } = await context.supabase
      .from("plan_levels")
      .select("key, label, widgets, sort_order, enabled")
      .eq("scope", "dashboard")
      .order("sort_order", { ascending: true });
    const catalogue = (levels ?? []).filter((l: any) => l.enabled !== false);
    const { cumulativeDashboardLevels } = await import("@/lib/plan-tiers");
    const included = cumulativeDashboardLevels(catalogue as any[], planTiers);
    let usable = included.length ? included : catalogue.filter((l: any) => l.key === "basic");

    // The client's own entitlement (paid / trial / comp / included) is a second
    // ceiling on top of the organisation's plan. Expiry is evaluated at read
    // time inside the database function, so a lapsed trial silently drops the
    // client back to free Standard with no scheduled job involved.
    const { clientEntitlement } = await import("@/lib/entitlement.server");
    const entitlement = await clientEntitlement(context.supabase, data.clientId);
    const entTier: any = catalogue.find((l: any) => l.key === entitlement.tier);
    const entCeiling = (entTier?.sort_order ?? null) as number | null;
    if (entCeiling !== null) {
      const bounded = usable.filter((l: any) => (l.sort_order ?? 0) <= entCeiling);
      usable = bounded.length ? bounded : usable.filter((l: any) => l.key === "basic");
    }



    const availableSet = new Set<WidgetKey>();
    for (const l of usable) for (const w of sanitizeWidgets(((l as any).widgets ?? []) as string[])) availableSet.add(w);
    // Fall back to the built-in defaults when the catalogue is empty.
    if (availableSet.size === 0) for (const w of DEFAULT_TIER_WIDGETS.basic) availableSet.add(w);

    const { data: client } = await context.supabase
      .from("clients")
      .select("dashboard_widgets, firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const saved = (client as any)?.dashboard_widgets as string[] | null | undefined;
    const configured = Array.isArray(saved);

    // Organisation-level defaults act as a ceiling: anything the firm has
    // unticked in "cards included by default" is unavailable to its clients.
    const firmId = (client as any)?.firm_id as string | null | undefined;
    if (firmId) {
      const { data: firmRow } = await (context.supabase as any)
        .from("firms")
        .select("default_widgets")
        .eq("id", firmId)
        .maybeSingle();
      const firmDefaults = (firmRow?.default_widgets as string[] | null | undefined) ?? null;
      if (Array.isArray(firmDefaults)) {
        for (const w of Array.from(availableSet)) {
          if (!firmDefaults.includes(w)) availableSet.delete(w);
        }
      }
    }

    // Final ceiling: the database decides entitlement (plan ∩ tier config).
    // Fail closed — an empty/errored result hides every widget.
    const { clientAllowedWidgets } = await import("@/lib/widget-access.server");
    const entitled = new Set<string>(await clientAllowedWidgets(context.supabase, data.clientId));
    for (const w of Array.from(availableSet)) if (!entitled.has(w)) availableSet.delete(w);

    const availableWidgets = ALL_WIDGETS.filter((w) => availableSet.has(w));

    const top: any = usable[usable.length - 1];
    const planLabel = usable.map((l: any) => l.label as string).join(", ");

    // "View as <tier>" preview renders that tier's catalogue list verbatim,
    // still bounded by the organisation's default-card selection.
    if (data.tierOverride) {
      const lvl: any = catalogue.find((l: any) => l.key === data.tierOverride);
      const preview = (lvl
        ? sanitizeWidgets((lvl.widgets ?? []) as string[])
        : defaultWidgetsFor(data.tierOverride)
      ).filter((w) => availableSet.has(w));
      return { widgets: preview, availableWidgets, configured, planLabel, highestTier: (top?.key ?? "basic") as string, entitlement };
    }

    const widgets = configured
      ? sanitizeWidgets(saved!).filter((w) => availableSet.has(w))
      : availableWidgets;


    return { widgets, availableWidgets, configured, planLabel, highestTier: (top?.key ?? "basic") as string, entitlement };

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

