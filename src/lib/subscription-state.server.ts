// Server-side reads of public.firm_subscription_state.
//
// The database is the single source of truth for expiry, day counts and the
// consolidation add-on. Nothing here recomputes them.

import type { SubscriptionState } from "@/lib/subscription-state";

/** public.me_is_super_admin() — the one database implementation of the rule. */
async function isSuperAdmin(supabase: any): Promise<boolean> {
  const { data } = await supabase.rpc("me_is_super_admin");
  return !!data;
}

/** The caller's own active memberships, from public.my_firm_memberships(). */
async function myFirmIds(supabase: any): Promise<Set<string>> {
  const { data } = await supabase.rpc("my_firm_memberships");
  return new Set(((data ?? []) as Array<{ firm_id: string }>).map((m) => m.firm_id));
}

/** Which of these organisations the caller is actual staff of (members only). */
export async function staffFirmIdsFor(
  supabase: any,
  _userId: string,
  firmIds: string[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(firmIds.filter(Boolean)));
  const out = new Set<string>();
  if (ids.length === 0) return out;

  const mine = await myFirmIds(supabase);
  for (const id of ids) if (mine.has(id)) out.add(id);

  // Platform admins are staff for the purpose of showing plan notices. This is
  // billing metadata only — it grants no access to client or Xero data.
  if (out.size < ids.length && (await isSuperAdmin(supabase))) {
    for (const id of ids) out.add(id);
  }
  return out;
}

/** key -> is_free for the organisation plan catalogue. */
async function freePlanKeys(supabase: any): Promise<Set<string>> {
  const { data } = await supabase.from("plan_levels").select("key, is_free").eq("scope", "firm");
  const out = new Set<string>();
  for (const p of (data ?? []) as Array<{ key: string; is_free: boolean | null }>) {
    if (p.is_free) out.add(p.key);
  }
  return out;
}

async function stateFor(supabase: any, firmId: string) {
  try {
    const { data, error } = await supabase.rpc("firm_subscription_state", { _firm_id: firmId });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  } catch {
    return null;
  }
}

export async function readSubscriptionStates(
  supabase: any,
  userId: string,
  firmIds: string[],
): Promise<SubscriptionState[]> {
  const ids = Array.from(new Set(firmIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const allowed = await staffFirmIdsFor(supabase, userId, ids);
  const visible = ids.filter((id) => allowed.has(id));
  if (visible.length === 0) return [];

  const [free, rows] = await Promise.all([
    freePlanKeys(supabase),
    Promise.all(visible.map((id) => stateFor(supabase, id))),
  ]);

  const out: SubscriptionState[] = [];
  visible.forEach((firmId, i) => {
    const r: any = rows[i];
    if (!r) return;
    out.push({
      firmId,
      planKey: r.plan_key ?? null,
      planLabel: r.plan_label ?? null,
      status: r.status ?? null,
      lapsed: !!r.lapsed,
      alwaysFree: !!r.always_free,
      isFree: !!(r.plan_key && free.has(r.plan_key)),
      endsAt: r.ends_at ?? null,
      daysRemaining: r.days_remaining ?? null,
      endingSoon: !!r.ending_soon,
      consolidation: !!r.consolidation,
    });
  });
  return out;
}

/** Organisations the caller works in that are ending soon or already lapsed. */
export async function listExpiringForStaff(
  supabase: any,
  userId: string,
): Promise<{ organisations: Array<SubscriptionState & { name: string }> }> {
  const superAdmin = await isSuperAdmin(supabase, userId);

  let firms: Array<{ id: string; name: string }> = [];
  if (superAdmin) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("firms").select("id, name");
    firms = (data ?? []) as Array<{ id: string; name: string }>;
  } else {
    const { data: memberships } = await supabase
      .from("firm_members")
      .select("firm_id, status")
      .eq("user_id", userId);
    const ids = ((memberships ?? []) as Array<{ firm_id: string; status: string | null }>)
      .filter((m) => !m.status || m.status === "active")
      .map((m) => m.firm_id);
    if (ids.length === 0) return { organisations: [] };
    const { data } = await supabase.from("firms").select("id, name").in("id", ids);
    firms = (data ?? []) as Array<{ id: string; name: string }>;
  }

  const states = await readSubscriptionStates(
    supabase,
    userId,
    firms.map((f) => f.id),
  );
  const nameById = new Map(firms.map((f) => [f.id, f.name]));
  const organisations = states
    .filter((s) => s.endingSoon || s.lapsed)
    .map((s) => ({ ...s, name: nameById.get(s.firmId) ?? "Organisation" }))
    .sort((a, b) => (a.daysRemaining ?? -1) - (b.daysRemaining ?? -1));

  return { organisations };
}
