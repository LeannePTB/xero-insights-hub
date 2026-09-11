import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { assertSuperAdminDb } from "@/lib/auth/super-admin.server";
import { clientLimitFor, firmLimitCatalogue } from "@/lib/firmPlans";


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



/**
 * Returns aggregate-only info for every firm. Used on the super-admin
 * dashboard. Intentionally does NOT include client names, Xero org names,
 * or any other per-client data.
 */
export const listFirmsForSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<{ firms: FirmOverviewCard[] }> => {
    await assertSuperAdminDb(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: firms, error } = await (supabaseAdmin as any)
      .from("firms")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const firmIds = (firms ?? []).map((f: any) => f.id);
    if (firmIds.length === 0) return { firms: [] };

    const [{ data: subs }, { data: clients }, { data: firmMeta }, { data: myMembership }] = await Promise.all([
      (supabaseAdmin as any).from("subscriptions").select("firm_id, tier, status, trial_ends_at, current_period_end, client_limit_override").in("firm_id", firmIds),
      (supabaseAdmin as any).from("clients").select("firm_id").in("firm_id", firmIds),
      (supabaseAdmin as any).from("firms").select("id, is_always_free").in("id", firmIds),
      (context.supabase as any).rpc("my_firm_ids"),
    ]);
    const { data: planRows } = await (supabaseAdmin as any).from("plan_levels").select("key, client_limit").eq("scope", "firm");
    const catalogue = firmLimitCatalogue(planRows);

    const subByFirm = new Map<string, any>();
    for (const s of subs ?? []) subByFirm.set(s.firm_id, s);
    const countByFirm = new Map<string, number>();
    for (const c of clients ?? []) countByFirm.set(c.firm_id, (countByFirm.get(c.firm_id) ?? 0) + 1);
    const freeByFirm = new Map<string, boolean>();
    for (const f of firmMeta ?? []) freeByFirm.set(f.id, !!f.is_always_free);
    const ownFirmIds = new Set<string>(((myMembership ?? []) as any[]).map((m) => m.firm_id));

    const cards: FirmOverviewCard[] = (firms ?? []).map((f: any) => {
      const sub = subByFirm.get(f.id);
      const isAlwaysFree = freeByFirm.get(f.id) ?? false;
      return {
        id: f.id,
        name: f.name,
        tier: sub?.tier ?? null,
        status: sub?.status ?? null,
        clientCount: countByFirm.get(f.id) ?? 0,
        clientLimit: clientLimitFor(sub?.tier, isAlwaysFree, { override: sub?.client_limit_override ?? null, catalogue }),
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
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<{ firms: FirmOverviewCard[] }> => {
    // Which organisations the caller belongs to is a database decision.
    const { data: mine, error } = await (context.supabase as any).rpc("my_firm_ids");
    if (error) throw new Error(error.message);
    const myIds = ((mine ?? []) as any[]).map((r) => r.firm_id as string);
    if (myIds.length === 0) return { firms: [] };
    const { data: firmRows, error: fErr } = await context.supabase
      .from("firms")
      .select("id, name")
      .in("id", myIds);
    if (fErr) throw new Error(fErr.message);
    const firms = ((firmRows ?? []) as any[]).map((f) => ({ id: f.id as string, name: f.name as string }));
    if (firms.length === 0) return { firms: [] };

    const firmIds = firms.map((f) => f.id);
    const [{ data: subs }, { data: clients }, { data: firmMeta }] = await Promise.all([
      context.supabase.from("subscriptions").select("firm_id, tier, status, trial_ends_at, current_period_end, client_limit_override").in("firm_id", firmIds),
      context.supabase.from("clients").select("firm_id").in("firm_id", firmIds),
      context.supabase.from("firms").select("id, is_always_free").in("id", firmIds),
    ]);
    const { data: planRows } = await (context.supabase as any).from("plan_levels").select("key, client_limit").eq("scope", "firm");
    const catalogue = firmLimitCatalogue(planRows);
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
          clientLimit: clientLimitFor(sub?.tier, isAlwaysFree, { override: sub?.client_limit_override ?? null, catalogue }),
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
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<{
    firm: { id: string; name: string };
    plan: FirmOverviewCard;
  }> => {
    // Membership is a database decision (`user_can_write_firm` = active member).
    const { data: isMember, error: mErr } = await (context.supabase as any).rpc("user_can_write_firm", {
      _user_id: context.userId,
      _firm_id: data.firmId,
    });
    if (mErr) throw new Error(mErr.message);
    let db: any = context.supabase;
    if (isMember !== true) {
      // Path C: a super admin who is not a member may still open an
      // organisation's billing page. This reads the client COUNT for that
      // organisation, which is metadata, not client or Xero data.
      // Flagged in the batch 3 report; behaviour deliberately unchanged.
      const { data: isSuper, error: sErr } = await (context.supabase as any).rpc("me_is_super_admin");
      if (sErr) throw new Error(sErr.message);
      if (isSuper !== true) throw new Error("Forbidden");
      db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }
    const [{ data: firm, error }, { data: sub }, { count: clientCount }] = await Promise.all([
      db.from("firms").select("id, name, is_always_free").eq("id", data.firmId).maybeSingle(),
      db.from("subscriptions").select("tier, status, trial_ends_at, current_period_end, client_limit_override").eq("firm_id", data.firmId).maybeSingle(),
      db.from("clients").select("id", { count: "exact", head: true }).eq("firm_id", data.firmId),
    ]);
    const { data: planRows } = await (db as any).from("plan_levels").select("key, client_limit").eq("scope", "firm");
    const catalogue = firmLimitCatalogue(planRows);
    if (error) throw new Error(error.message);
    if (!firm) throw new Error("Organisation not found.");
    const s: any = sub ?? {};
    const isAlwaysFree = !!(firm as any).is_always_free;
    const plan: FirmOverviewCard = {
      id: (firm as any).id,
      name: (firm as any).name,
      tier: s.tier ?? null,
      status: s.status ?? null,
      clientCount: clientCount ?? 0,
      clientLimit: clientLimitFor(s.tier, isAlwaysFree, { override: s.client_limit_override ?? null, catalogue }),
      isAlwaysFree,
      trialEndsAt: s.trial_ends_at ?? null,
      currentPeriodEnd: s.current_period_end ?? null,
      isOwn: true,
    };
    return { firm: { id: (firm as any).id, name: (firm as any).name }, plan };
  });

