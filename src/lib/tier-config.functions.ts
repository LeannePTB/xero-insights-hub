import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_TIERS, ALL_WIDGETS, DEFAULT_TIER_WIDGETS, type DashboardTier, type WidgetKey } from "@/lib/tiers";

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


// Returns global defaults plus, optionally, the overrides for one client.
export const listTierConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tier_widget_config")
      .select("id, client_id, tier, widgets")
      .or(`client_id.is.null${data.clientId ? `,client_id.eq.${data.clientId}` : ""}`);
    if (error) throw new Error(error.message);

    const byKey = new Map<string, WidgetKey[]>();
    for (const r of rows ?? []) {
      byKey.set(`${r.client_id ?? "global"}:${r.tier}`, sanitizeWidgets(r.widgets ?? []));
    }
    const build = (clientKey: string) =>
      Object.fromEntries(
        ALL_TIERS.map((t) => [
          t,
          byKey.get(`${clientKey}:${t}`) ?? (clientKey === "global" ? DEFAULT_TIER_WIDGETS[t] : null),
        ]),
      ) as Record<DashboardTier, WidgetKey[] | null>;

    return {
      global: build("global") as Record<DashboardTier, WidgetKey[]>,
      client: data.clientId ? build(data.clientId) : null,
    };
  });

export const saveTierWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string | null; tier: DashboardTier; widgets: WidgetKey[] | null }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // null widgets on a client override = remove override (fall back to global)
    if (data.clientId && data.widgets === null) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .delete()
        .eq("client_id", data.clientId)
        .eq("tier", data.tier);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const widgets = sanitizeWidgets(data.widgets ?? []);

    // Client-level overrides may only target tiers the organisation's plan includes.
    if (data.clientId) {
      const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
      const planTiers = await allowedTiersForClient(data.clientId);
      if (planTiers && !planTiers.includes(data.tier)) {
        throw new Error("This tier is not included in the organisation's plan.");
      }
    }

    // Unique indexes on this table are partial (one for global rows, one for
    // client rows), so ON CONFLICT can't be used — do select/update/insert.
    let query = supabaseAdmin
      .from("tier_widget_config")
      .select("id")
      .eq("tier", data.tier);
    query = data.clientId === null ? query.is("client_id", null) : query.eq("client_id", data.clientId);
    const { data: existing, error: findErr } = await query.maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing) {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .update({ widgets })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .insert({ client_id: data.clientId, tier: data.tier, widgets });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


// Resolves effective widgets for a client + tier (client override → global → defaults).
export const getEffectiveWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tier_widget_config")
      .select("client_id, widgets")
      .eq("tier", data.tier)
      .or(`client_id.is.null,client_id.eq.${data.clientId}`);
    if (error) throw new Error(error.message);

    const override = rows?.find((r) => r.client_id === data.clientId)?.widgets;
    const global = rows?.find((r) => r.client_id === null)?.widgets;
    const widgets = sanitizeWidgets((override ?? global ?? DEFAULT_TIER_WIDGETS[data.tier]) as string[]);
    return { widgets };
  });

// Global on/off per tier.
export const listTierSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tier_settings")
      .select("tier, enabled");
    if (error) throw new Error(error.message);
    const map = Object.fromEntries(ALL_TIERS.map((t) => [t, true])) as Record<DashboardTier, boolean>;
    for (const r of data ?? []) map[r.tier as DashboardTier] = !!r.enabled;
    return { enabled: map };
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

    // Resolved widgets per tier (client override → global → defaults).
    const { data: cfgRows } = await context.supabase
      .from("tier_widget_config")
      .select("client_id, tier, widgets")
      .or(`client_id.is.null,client_id.eq.${data.clientId}`);
    const byKey = new Map<string, WidgetKey[]>();
    for (const r of cfgRows ?? []) {
      byKey.set(`${(r as any).client_id ?? "global"}:${(r as any).tier}`, sanitizeWidgets((r as any).widgets ?? []));
    }
    const resolve = (t: DashboardTier): WidgetKey[] =>
      byKey.get(`${data.clientId}:${t}`) ?? byKey.get(`global:${t}`) ?? DEFAULT_TIER_WIDGETS[t];

    const currentWidgets = new Set<WidgetKey>(resolve(data.currentTier));
    const order: DashboardTier[] = ["basic", "advisory", "investigate", "multi_company"];
    const currentIdx = order.indexOf(data.currentTier);

    // Only advertise tiers this organisation's plan actually includes.
    const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
    const planTiers = await allowedTiersForClient(data.clientId);

    const upgrades = order
      .map((tier, idx) => ({ tier, idx }))
      .filter(({ tier, idx }) => idx > currentIdx && enabledMap[tier] && (!planTiers || planTiers.includes(tier)))
      .map(({ tier }) => {
        const widgets = resolve(tier);
        const extra = widgets.filter((w) => !currentWidgets.has(w));
        return { tier, widgets, extraWidgets: extra };
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
    const included = catalogue.filter((l: any) => !planTiers || planTiers.includes(l.key));
    const usable = included.length ? included : catalogue.filter((l: any) => l.key === "basic");

    const availableSet = new Set<WidgetKey>();
    for (const l of usable) for (const w of sanitizeWidgets(((l as any).widgets ?? []) as string[])) availableSet.add(w);
    // Fall back to the built-in defaults when the catalogue is empty.
    if (availableSet.size === 0) for (const w of DEFAULT_TIER_WIDGETS.basic) availableSet.add(w);
    const availableWidgets = ALL_WIDGETS.filter((w) => availableSet.has(w));

    const { data: client } = await context.supabase
      .from("clients")
      .select("dashboard_widgets")
      .eq("id", data.clientId)
      .maybeSingle();
    const saved = (client as any)?.dashboard_widgets as string[] | null | undefined;
    const configured = Array.isArray(saved);

    const top: any = usable[usable.length - 1];
    const planLabel = usable.map((l: any) => l.label as string).join(", ");

    // "View as <tier>" preview renders that tier's catalogue list verbatim.
    if (data.tierOverride) {
      const lvl: any = catalogue.find((l: any) => l.key === data.tierOverride);
      const preview = lvl
        ? sanitizeWidgets((lvl.widgets ?? []) as string[])
        : DEFAULT_TIER_WIDGETS[data.tierOverride];
      return { widgets: preview, availableWidgets, configured, planLabel, highestTier: (top?.key ?? "basic") as string };
    }

    const widgets = configured
      ? sanitizeWidgets(saved!).filter((w) => availableSet.has(w))
      : availableWidgets;

    return { widgets, availableWidgets, configured, planLabel, highestTier: (top?.key ?? "basic") as string };
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
        .select("key, widgets, enabled")
        .eq("scope", "dashboard");
      const usable = (levels ?? []).filter(
        (l: any) => l.enabled !== false && (!planTiers || planTiers.includes(l.key)),
      );
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
