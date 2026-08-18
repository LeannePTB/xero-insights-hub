import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes, createHash } from "crypto";
import { xeroScopeString } from "@/lib/xero/scopes";

/**
 * Bulk reconnect for one organisation.
 *
 * This is the existing `flow = 'reconnect'` path with a list of tenants
 * instead of one. No new flow value, no new column: `pending_tenant_ids`
 * already holds the targets and the single-file case is simply an array of
 * one. The callback refreshes tokens and scopes only — it never creates a
 * connection row, never touches `firm_id`, and ignores every tenant Xero
 * returns that isn't already linked to this organisation.
 */

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const CANONICAL_XERO_APP_ORIGIN = "https://tractionadvisory.com.au";
const XERO_CALLBACK_URL = `${CANONICAL_XERO_APP_ORIGIN}/api/public/xero/callback`;

/** Guard against an unusable authorise URL / state row. */
export const MAX_BULK_RECONNECT_TENANTS = 25;

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return CANONICAL_XERO_APP_ORIGIN;
  }
}

export type FirmXeroFile = {
  connectionId: string;
  tenantId: string;
  tenantName: string;
  status: string;
  missingScopes: string[];
};

/**
 * The organisation's Xero files, with the scopes each one is still missing.
 * Missing scopes come from `public.xero_missing_scopes(connection_id)` — the
 * real measure of whether a reconnect worked. Reads through the caller's
 * session so RLS decides visibility.
 */
export const listFirmXeroFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("xero_connections")
      .select("id, tenant_id, tenant_name, status")
      .eq("firm_id", data.firmId)
      .order("tenant_name", { ascending: true });
    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const files: FirmXeroFile[] = [];
    for (const row of rows ?? []) {
      const tenantId = row.tenant_id as string;
      if (seen.has(tenantId)) continue;
      seen.add(tenantId);
      let missing: string[] = [];
      const { data: result, error: rpcError } = await (context.supabase as any).rpc(
        "xero_missing_scopes",
        { _connection_id: row.id },
      );
      if (rpcError) {
        console.warn("[xero] xero_missing_scopes failed", rpcError.message);
      } else if (Array.isArray(result)) {
        missing = result as string[];
      }
      files.push({
        connectionId: row.id as string,
        tenantId,
        tenantName: (row.tenant_name as string) ?? "Unknown",
        status: (row.status as string) ?? "connected",
        missingScopes: missing,
      });
    }
    return { files };
  });

/**
 * Start one OAuth round trip that reauthorises every Xero file linked to this
 * organisation. Xero returns only the organisations the user ticks on the
 * consent screen, so partial results are normal and the callback reports them
 * per file.
 */
export const startXeroReconnectAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Xero is not configured yet. The app owner needs to add XERO_CLIENT_ID and XERO_CLIENT_SECRET.",
      );
    }

    const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
    if (!(await platformStaffCanAccessFirm(context.userId, data.firmId))) {
      throw new Error("You cannot manage this organisation's Xero connections.");
    }

    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(`xero:connect:${context.userId}`, 10, 3600);

    const { data: rows, error } = await context.supabase
      .from("xero_connections")
      .select("tenant_id")
      .eq("firm_id", data.firmId);
    if (error) throw new Error(error.message);
    const tenantIds = [...new Set((rows ?? []).map((r: any) => r.tenant_id as string))];

    if (tenantIds.length < 1) {
      throw new Error("This organisation has no Xero files to reconnect.");
    }
    if (tenantIds.length > MAX_BULK_RECONNECT_TENANTS) {
      throw new Error(
        `This organisation has ${tenantIds.length} Xero files, which is more than the ${MAX_BULK_RECONNECT_TENANTS} we can reconnect in one go. Reconnect them from each client's settings instead.`,
      );
    }

    const state = randomBytes(24).toString("hex");
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const { error: insertError } = await context.supabase.from("xero_oauth_states").insert({
      state,
      user_id: context.userId,
      code_verifier: codeVerifier,
      return_origin: normalizeOrigin(data.origin),
      client_id: null,
      firm_id: data.firmId,
      flow: "reconnect",
      known_tenant_ids: tenantIds,
      pending_tenant_ids: tenantIds,
    } as any);
    if (insertError) throw new Error(insertError.message);

    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", XERO_CALLBACK_URL);
    url.searchParams.set("scope", xeroScopeString());
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizeUrl: url.toString(), fileCount: tenantIds.length };
  });
