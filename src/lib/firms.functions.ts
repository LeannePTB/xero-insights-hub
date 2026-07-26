import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientLimitFor } from "@/lib/firmPlans";


export type FirmOverviewCard = {
  id: string;
  name: string;
  tier: string | null;
  status: string | null;
  clientCount: number;
  clientLimit: number;
  isAlwaysFree: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  isOwn: boolean;
};


async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/**
 * Returns aggregate-only info for every firm. Used on the super-admin
 * dashboard. Intentionally does NOT include client names, Xero org names,
 * or any other per-client data.
 */
export const listFirmsForSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ firms: FirmOverviewCard[] }> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: firms, error } = await (supabaseAdmin as any)
      .from("firms")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const firmIds = (firms ?? []).map((f: any) => f.id);
    if (firmIds.length === 0) return { firms: [] };

    const [{ data: subs }, { data: clients }, { data: firmMeta }, { data: myMembership }] = await Promise.all([
      (supabaseAdmin as any).from("subscriptions").select("firm_id, tier, status, trial_ends_at, current_period_end").in("firm_id", firmIds),
      (supabaseAdmin as any).from("clients").select("firm_id").in("firm_id", firmIds),
      (supabaseAdmin as any).from("firms").select("id, is_always_free").in("id", firmIds),
      (supabaseAdmin as any).from("firm_members").select("firm_id").eq("user_id", context.userId),
    ]);

    const subByFirm = new Map<string, any>();
    for (const s of subs ?? []) subByFirm.set(s.firm_id, s);
    const countByFirm = new Map<string, number>();
    for (const c of clients ?? []) countByFirm.set(c.firm_id, (countByFirm.get(c.firm_id) ?? 0) + 1);
    const freeByFirm = new Map<string, boolean>();
    for (const f of firmMeta ?? []) freeByFirm.set(f.id, !!f.is_always_free);
    const ownFirmIds = new Set<string>((myMembership ?? []).map((m: any) => m.firm_id));

    const cards: FirmOverviewCard[] = (firms ?? []).map((f: any) => {
      const sub = subByFirm.get(f.id);
      const isAlwaysFree = freeByFirm.get(f.id) ?? false;
      return {
        id: f.id,
        name: f.name,
        tier: sub?.tier ?? null,
        status: sub?.status ?? null,
        clientCount: countByFirm.get(f.id) ?? 0,
        clientLimit: clientLimitFor(sub?.tier, isAlwaysFree),
        isAlwaysFree,
        trialEndsAt: sub?.trial_ends_at ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
        isOwn: ownFirmIds.has(f.id),
      };
    });

    cards.sort((a, b) => {
      if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { firms: cards };
  });


/**
 * Returns the firms the current user is a member of, with tier and client count.
 * Powers the top-level organisations grid and scopes "add client" to a firm.
 */
export const listMyFirms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ firms: FirmOverviewCard[] }> => {
    const { data, error } = await context.supabase
      .from("firm_members")
      .select("firm_id, firms(id, name)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const firms = ((data ?? []) as any[])
      .map((r) => r.firms)
      .filter(Boolean)
      .map((f: any) => ({ id: f.id as string, name: f.name as string }));
    if (firms.length === 0) return { firms: [] };

    const firmIds = firms.map((f) => f.id);
    const [{ data: subs }, { data: clients }, { data: firmMeta }] = await Promise.all([
      context.supabase.from("subscriptions").select("firm_id, tier, status, trial_ends_at, current_period_end").in("firm_id", firmIds),
      context.supabase.from("clients").select("firm_id").in("firm_id", firmIds),
      context.supabase.from("firms").select("id, is_always_free").in("id", firmIds),
    ]);
    const subByFirm = new Map<string, any>();
    for (const s of (subs ?? []) as any[]) subByFirm.set(s.firm_id, s);
    const countByFirm = new Map<string, number>();
    for (const c of (clients ?? []) as any[]) countByFirm.set(c.firm_id, (countByFirm.get(c.firm_id) ?? 0) + 1);
    const freeByFirm = new Map<string, boolean>();
    for (const f of (firmMeta ?? []) as any[]) freeByFirm.set(f.id, !!f.is_always_free);

    const cards: FirmOverviewCard[] = firms
      .map((f) => {
        const sub = subByFirm.get(f.id);
        const isAlwaysFree = freeByFirm.get(f.id) ?? false;
        return {
          id: f.id,
          name: f.name,
          tier: sub?.tier ?? null,
          status: sub?.status ?? null,
          clientCount: countByFirm.get(f.id) ?? 0,
          clientLimit: clientLimitFor(sub?.tier, isAlwaysFree),
          isAlwaysFree,
          trialEndsAt: sub?.trial_ends_at ?? null,
          currentPeriodEnd: sub?.current_period_end ?? null,
          isOwn: true,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { firms: cards };
  });


/**
 * Returns one firm by id. Requires the caller to be a member of that firm.
 */
export const getMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<{ firm: { id: string; name: string } }> => {
    const { data: membership } = await context.supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", context.userId)
      .eq("firm_id", data.firmId)
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");
    const { data: firm, error } = await context.supabase
      .from("firms")
      .select("id, name")
      .eq("id", data.firmId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!firm) throw new Error("Firm not found.");
    return { firm: firm as any };
  });
