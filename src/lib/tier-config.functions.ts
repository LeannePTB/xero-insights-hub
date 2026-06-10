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
    .eq("role", "advisor");
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
    // upsert keyed on (client_id, tier); NULL client_id needs manual handling.
    if (data.clientId === null) {
      const { data: existing } = await supabaseAdmin
        .from("tier_widget_config")
        .select("id")
        .is("client_id", null)
        .eq("tier", data.tier)
        .maybeSingle();
      if (existing) {
        const { error } = await supabaseAdmin
          .from("tier_widget_config")
          .update({ widgets })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin
          .from("tier_widget_config")
          .insert({ client_id: null, tier: data.tier, widgets });
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("tier_widget_config")
        .upsert(
          { client_id: data.clientId, tier: data.tier, widgets },
          { onConflict: "client_id,tier" },
        );
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
