import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanScope = "firm" | "dashboard";

export type PlanLevel = {
  id: string;
  scope: PlanScope;
  key: string;
  label: string;
  description: string;
  client_limit: number;
  xero_org_limit: number;
  allows_multi_org: boolean;
  widgets: string[];
  /** Firm-scope only: dashboard tier keys this plan may grant. Empty = all. */
  allowed_tiers: string[];
  sort_order: number;
  enabled: boolean;
};

const COLS =
  "id, scope, key, label, description, client_limit, xero_org_limit, allows_multi_org, widgets, allowed_tiers, sort_order, enabled";

/** Readable by any signed-in user — powers plan/tier dropdowns everywhere. */
export const listPlanLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ levels: PlanLevel[] }> => {
    const { data, error } = await (context.supabase as any)
      .from("plan_levels")
      .select(COLS)
      .order("scope", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { levels: (data ?? []) as PlanLevel[] };
  });

async function assertSuperAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("me_is_super_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Super admins only.");
}

export const savePlanLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string | null;
      scope: PlanScope;
      key: string;
      label: string;
      description?: string;
      client_limit?: number;
      xero_org_limit?: number;
      allows_multi_org?: boolean;
      widgets?: string[];
      allowed_tiers?: string[];
      sort_order?: number;
      enabled?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const key = data.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key) throw new Error("A key is required.");
    if (!data.label.trim()) throw new Error("A label is required.");

    const row = {
      scope: data.scope,
      key,
      label: data.label.trim(),
      description: data.description ?? "",
      client_limit: Math.max(0, data.client_limit ?? 0),
      xero_org_limit: Math.max(1, data.xero_org_limit ?? 1),
      allows_multi_org: !!data.allows_multi_org,
      widgets: data.widgets ?? [],
      sort_order: data.sort_order ?? 100,
      enabled: data.enabled ?? true,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await (supabaseAdmin as any).from("plan_levels").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("plan_levels")
      .upsert(row, { onConflict: "scope,key" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id as string };
  });

export const deletePlanLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: level } = await (supabaseAdmin as any)
      .from("plan_levels")
      .select("scope, key")
      .eq("id", data.id)
      .maybeSingle();
    if (!level) throw new Error("Level not found.");

    if (level.scope === "firm") {
      const { count } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("tier", level.key);
      if ((count ?? 0) > 0) throw new Error("This plan is in use by an organisation — move them first.");
    } else {
      const { count } = await (supabaseAdmin as any)
        .from("client_access")
        .select("id", { count: "exact", head: true })
        .eq("tier", level.key);
      if ((count ?? 0) > 0) throw new Error("This tier is in use by a client — move them first.");
    }

    const { error } = await (supabaseAdmin as any).from("plan_levels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
