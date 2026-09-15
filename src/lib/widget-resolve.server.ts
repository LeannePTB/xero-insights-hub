// Server-only resolution of dashboard cards.
//
// KNOWN INVARIANT 6 VIOLATION, being retired. Everything below the v2 helpers
// is a TypeScript mirror of the database's old deny-list rule (ceiling from
// plan_levels minus tier_widget_config exclusions). It exists only for the
// legacy card model and for the configuration screens that write the old rows.
// It is NOT the card gate: the gate is public.assert_widget_access, and the list
// is public.client_allowed_widgets, both in the database.
//
// The new model has ONE implementation, in the database, and this file only
// forwards to it:
//   cardModelV2()        -> public.card_model_active()
//   visibleCardsV2()     -> public.client_visible_cards()   (purchase ∩ ticked)
//   availableCardsV2()   -> public.client_available_cards()  (purchase only)
// Every caller that shows "what this client sees" must ask cardModelV2() first
// and use these when it answers true. Nothing here re-derives the new rule.
//
// Legacy model (switch off):
//   ceiling  = plan_levels.widgets for the dashboard tier
//   excluded = organisation row if present, ELSE platform row (precedence,
//              not union), PLUS the client row's own exclusions
//   visible  = ceiling − excluded
// Mirrors public.client_allowed_widgets' v1 branch — never diverge from it.

import { ALL_WIDGETS, DEFAULT_TIER_WIDGETS, type WidgetKey } from "@/lib/tiers";

/** True once the purchase + ticked-list model is switched on. Fails closed. */
export async function cardModelV2(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("card_model_active");
    if (error) return false;
    return data === "v2";
  } catch {
    return false;
  }
}

/** The cards this client sees: the organisation's purchase ∩ the ticked list. */
export async function visibleCardsV2(supabase: any, clientId: string): Promise<WidgetKey[]> {
  const { data, error } = await supabase.rpc("client_visible_cards", { _client_id: clientId });
  if (error) return [];
  return sanitizeWidgets((data ?? []) as string[]);
}

/** The cards the organisation's purchase allows for this client, before ticks. */
export async function availableCardsV2(supabase: any, clientId: string): Promise<WidgetKey[]> {
  const { data, error } = await supabase.rpc("client_available_cards", { _client_id: clientId });
  if (error) return [];
  return sanitizeWidgets((data ?? []) as string[]);
}


export function sanitizeWidgets(widgets: readonly string[] | null | undefined): WidgetKey[] {
  return (widgets ?? []).filter((w): w is WidgetKey => (ALL_WIDGETS as readonly string[]).includes(w));
}

export type TierCeilings = Map<string, WidgetKey[]>;

/** plan_levels.widgets per dashboard tier — the ceiling a tier can ever show. */
export async function tierCeilings(supabase: any): Promise<TierCeilings> {
  const { data } = await supabase
    .from("plan_levels")
    .select("key, widgets, enabled")
    .eq("scope", "dashboard")
    .order("sort_order", { ascending: true });
  const map: TierCeilings = new Map();
  for (const r of ((data ?? []) as any[]).filter((l) => l.enabled !== false)) {
    map.set(r.key as string, sanitizeWidgets(r.widgets as string[] | null));
  }
  return map;
}

export function ceilingFor(ceilings: TierCeilings, tier: string): WidgetKey[] {
  const c = ceilings.get(tier);
  if (c && c.length) return c;
  return (DEFAULT_TIER_WIDGETS as any)[tier] ?? [];
}

export type ExclusionRow = {
  client_id: string | null;
  firm_id: string | null;
  tier: string;
  excluded_widgets: string[] | null;
};

/** Exclusion rows for the platform default, one organisation, and any clients. */
export async function fetchExclusions(
  supabase: any,
  opts: { firmId?: string | null; clientIds?: string[] },
): Promise<ExclusionRow[]> {
  const out: ExclusionRow[] = [];
  const cols = "client_id, firm_id, tier, excluded_widgets";

  const { data: platform } = await supabase
    .from("tier_widget_config")
    .select(cols)
    .is("client_id", null)
    .is("firm_id", null);
  out.push(...((platform ?? []) as ExclusionRow[]));

  if (opts.firmId) {
    const { data: org } = await supabase
      .from("tier_widget_config")
      .select(cols)
      .is("client_id", null)
      .eq("firm_id", opts.firmId);
    out.push(...((org ?? []) as ExclusionRow[]));
  }

  if (opts.clientIds?.length) {
    const { data: cli } = await supabase
      .from("tier_widget_config")
      .select(cols)
      .in("client_id", opts.clientIds);
    out.push(...((cli ?? []) as ExclusionRow[]));
  }

  return out;
}

export class ExclusionIndex {
  private platform = new Map<string, WidgetKey[]>();
  private org = new Map<string, WidgetKey[]>();
  private client = new Map<string, WidgetKey[]>();

  constructor(rows: ExclusionRow[]) {
    for (const r of rows) {
      const ex = sanitizeWidgets(r.excluded_widgets);
      if (r.client_id) this.client.set(`${r.client_id}:${r.tier}`, ex);
      else if (r.firm_id) this.org.set(`${r.firm_id}:${r.tier}`, ex);
      else this.platform.set(r.tier, ex);
    }
  }

  /** Base exclusions: the organisation row REPLACES the platform default. */
  base(tier: string, firmId?: string | null): WidgetKey[] {
    if (firmId) {
      const o = this.org.get(`${firmId}:${tier}`);
      if (o) return o;
    }
    return this.platform.get(tier) ?? [];
  }

  effective(tier: string, opts: { firmId?: string | null; clientId?: string | null }): WidgetKey[] {
    const set = new Set<WidgetKey>(this.base(tier, opts.firmId ?? null));
    if (opts.clientId) for (const w of this.client.get(`${opts.clientId}:${tier}`) ?? []) set.add(w);
    return Array.from(set);
  }

  /** Tiers for which this client has its own exclusion row. */
  clientTiers(clientId: string): string[] {
    return Array.from(this.client.keys())
      .filter((k) => k.startsWith(`${clientId}:`))
      .map((k) => k.slice(clientId.length + 1));
  }

  hasOrgRow(tier: string, firmId: string): boolean {
    return this.org.has(`${firmId}:${tier}`);
  }
}

export function visibleWidgets(ceiling: WidgetKey[], excluded: WidgetKey[]): WidgetKey[] {
  const off = new Set(excluded);
  return ceiling.filter((w) => !off.has(w));
}
