// Entitlement is computed by ONE rule, and that rule lives in the database
// (public.client_entitlement). Server code calls it; it never reimplements it.
// Expiry is evaluated at read time, so an expired trial stops granting the
// higher dashboard on the very next request.

export type EntitlementSource =
  | "paid"
  | "trial"
  | "free_forever"
  | "org_always_free"
  | "none";

export type Entitlement = {
  tier: string;
  source: EntitlementSource;
  expiresAt: string | null;
  inGrace: boolean;
};

const FAIL_CLOSED: Entitlement = {
  tier: "basic",
  source: "none",
  expiresAt: null,
  inGrace: false,
};

/**
 * Effective dashboard entitlement for a client.
 * Always call with the *user's* supabase client (RLS/auth.uid() applies inside
 * the function). Any error resolves to free Standard — never to a higher tier.
 */
export async function clientEntitlement(
  supabase: any,
  clientId: string,
): Promise<Entitlement> {
  try {
    const { data, error } = await supabase.rpc("client_entitlement", {
      _client_id: clientId,
    });
    if (error) return FAIL_CLOSED;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return FAIL_CLOSED;
    return {
      tier: (row.tier as string) ?? "basic",
      source: ((row.source as EntitlementSource) ?? "none"),
      expiresAt: (row.expires_at as string | null) ?? null,
      inGrace: Boolean(row.in_grace),
    };
  } catch {
    return FAIL_CLOSED;
  }
}
