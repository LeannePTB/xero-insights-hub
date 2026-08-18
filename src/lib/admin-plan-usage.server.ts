// Plan usage for the Organisations table.
//
// Vocabulary: a **plan** is what an organisation pays for (PTB, Multi
// Companies…); a **tier** is what a client's dashboard shows (Standard,
// Advisory…). Limits come from public.firm_plan_limits and the effective
// dashboard tier from public.client_entitlement — neither is recomputed here.

export type OrganisationUsage = {
  firmId: string;
  clientsUsed: number | null;
  clientLimit: number | null;
  xeroFilesUsed: number | null;
  xeroOrgLimit: number | null;
  /** Effective dashboard tier key -> number of clients on it. */
  dashboards: Record<string, number>;
  /** True when we could not see every client of the organisation. */
  dashboardsPartial: boolean;
};

async function limitsFor(supabase: any, firmId: string) {
  try {
    const { data, error } = await supabase.rpc("firm_plan_limits", { _firm_id: firmId });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  } catch {
    return null;
  }
}

async function entitlementTier(supabase: any, clientId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("client_entitlement", { _client_id: clientId });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row?.tier as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * One grouped read for the clients, one limits call per organisation and one
 * entitlement call per client, all issued concurrently — no per-row waterfall.
 */
export async function organisationUsage(
  supabase: any,
  firmIds: string[],
): Promise<OrganisationUsage[]> {
  const ids = Array.from(new Set(firmIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const [limitRows, clientsRes] = await Promise.all([
    Promise.all(ids.map((id) => limitsFor(supabase, id))),
    supabase.from("clients").select("id, firm_id").in("firm_id", ids),
  ]);

  const clients = ((clientsRes?.data ?? []) as Array<{ id: string; firm_id: string }>).filter(
    (c) => c.firm_id,
  );
  const tiers = await Promise.all(clients.map((c) => entitlementTier(supabase, c.id)));

  const byFirm = new Map<string, Record<string, number>>();
  const seen = new Map<string, number>();
  clients.forEach((c, i) => {
    const tier = tiers[i];
    seen.set(c.firm_id, (seen.get(c.firm_id) ?? 0) + 1);
    if (!tier) return;
    const bucket = byFirm.get(c.firm_id) ?? {};
    bucket[tier] = (bucket[tier] ?? 0) + 1;
    byFirm.set(c.firm_id, bucket);
  });

  return ids.map((firmId, i) => {
    const l = limitRows[i] as any;
    const clientsUsed = l?.clients_used ?? null;
    const visible = seen.get(firmId) ?? 0;
    return {
      firmId,
      clientsUsed,
      clientLimit: l?.client_limit ?? null,
      xeroFilesUsed: l?.xero_files_used ?? null,
      xeroOrgLimit: l?.xero_org_limit ?? null,
      dashboards: byFirm.get(firmId) ?? {},
      dashboardsPartial: clientsUsed != null && visible < clientsUsed,
    };
  });
}
