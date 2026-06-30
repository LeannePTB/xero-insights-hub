import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FirmOverviewCard = {
  id: string;
  name: string;
  tier: string | null;
  status: string | null;
  clientCount: number;
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

    const [{ data: subs }, { data: clients }, { data: myMembership }] = await Promise.all([
      (supabaseAdmin as any).from("subscriptions").select("firm_id, tier, status").in("firm_id", firmIds),
      (supabaseAdmin as any).from("clients").select("firm_id").in("firm_id", firmIds),
      (supabaseAdmin as any).from("firm_members").select("firm_id").eq("user_id", context.userId),
    ]);

    const subByFirm = new Map<string, { tier: string | null; status: string | null }>();
    for (const s of subs ?? []) subByFirm.set(s.firm_id, { tier: s.tier ?? null, status: s.status ?? null });
    const countByFirm = new Map<string, number>();
    for (const c of clients ?? []) countByFirm.set(c.firm_id, (countByFirm.get(c.firm_id) ?? 0) + 1);
    const ownFirmIds = new Set<string>((myMembership ?? []).map((m: any) => m.firm_id));

    const cards: FirmOverviewCard[] = (firms ?? []).map((f: any) => {
      const sub = subByFirm.get(f.id);
      return {
        id: f.id,
        name: f.name,
        tier: sub?.tier ?? null,
        status: sub?.status ?? null,
        clientCount: countByFirm.get(f.id) ?? 0,
        isOwn: ownFirmIds.has(f.id),
      };
    });

    // Own firm(s) first, then others alphabetically
    cards.sort((a, b) => {
      if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { firms: cards };
  });

/**
 * Returns the firms the current user is a member of.
 * Used to scope client lists and "add client" to a specific firm.
 */
export const listMyFirms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ firms: { id: string; name: string }[] }> => {
    const { data, error } = await context.supabase
      .from("firm_members")
      .select("firm_id, firms(id, name)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const firms = ((data ?? []) as any[])
      .map((r) => r.firms)
      .filter(Boolean)
      .map((f: any) => ({ id: f.id, name: f.name }));
    return { firms };
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
