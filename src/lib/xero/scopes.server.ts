// Server-only: build the Xero authorisation scope string from the database.
//
// `public.xero_required_scopes()` is the single source of truth. If it cannot
// be read we fail loudly rather than falling back to a stale hardcoded list —
// a silent fallback is exactly how a newly required scope goes un-requested.
import { assertReadOnlyScopes } from "@/lib/xero/scopes";

let cached: { at: number; scopes: string[] } | null = null;
const TTL_MS = 60_000;

/** The required Xero scopes, straight from `public.xero_required_scopes()`. */
export async function xeroRequiredScopes(): Promise<string[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.scopes;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("xero_required_scopes");
  if (error) {
    throw new Error(
      `Could not read the required Xero permissions from the database: ${error.message}`,
    );
  }
  const scopes = Array.isArray(data) ? (data as string[]).filter(Boolean) : [];
  if (scopes.length === 0) {
    throw new Error("The required Xero permission list is empty; cannot start authorisation.");
  }
  assertReadOnlyScopes(scopes);
  cached = { at: Date.now(), scopes };
  return scopes;
}

/** The `scope=` parameter for Xero's authorise URL. */
export async function xeroRequiredScopeString(): Promise<string> {
  return (await xeroRequiredScopes()).join(" ");
}
