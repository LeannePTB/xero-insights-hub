// Server-only helpers for the bulk "Reconnect all Xero files" flow.
//
// This is the existing `flow = 'reconnect'` path with a list of tenants
// instead of one. No new flow value and no new column: `pending_tenant_ids`
// already holds the targets and the single-file case is an array of one.
import { randomBytes, createHash } from "crypto";
import { xeroRequiredScopeString } from "@/lib/xero/scopes.server";
import { MAX_BULK_RECONNECT_TENANTS, type FirmXeroFile } from "@/lib/xero/reconnect-all.shared";

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const CANONICAL_XERO_APP_ORIGIN = "https://tractionadvisory.com.au";
const XERO_CALLBACK_URL = `${CANONICAL_XERO_APP_ORIGIN}/api/public/xero/callback`;

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

/**
 * The organisation's Xero files with the scopes each one is still missing.
 * Missing scopes come from `public.xero_missing_scopes(connection_id)` — the
 * real measure of whether a reconnect worked. Reads through the caller's
 * session, so RLS decides visibility.
 */
export async function readFirmXeroFiles(supabase: any, firmId: string): Promise<FirmXeroFile[]> {
  const { data: rows, error } = await supabase
    .from("xero_connections")
    .select("id, tenant_id, tenant_name, status")
    .eq("firm_id", firmId)
    .order("tenant_name", { ascending: true });
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const files: FirmXeroFile[] = [];
  for (const row of rows ?? []) {
    const tenantId = row.tenant_id as string;
    if (seen.has(tenantId)) continue;
    seen.add(tenantId);
    let missing: string[] = [];
    const { data: result, error: rpcError } = await supabase.rpc("xero_missing_scopes", {
      _connection_id: row.id,
    });
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
  return files;
}

/**
 * Mint a PKCE state row targeting every tenant currently linked to the
 * organisation, and return Xero's authorise URL.
 */
export async function startFirmReconnectAll(
  supabase: any,
  userId: string,
  firmId: string,
  origin: string,
): Promise<{ authorizeUrl: string; fileCount: number }> {
  const clientId = process.env.XERO_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Xero is not configured yet. The app owner needs to add XERO_CLIENT_ID and XERO_CLIENT_SECRET.",
    );
  }

  const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
  if (!(await platformStaffCanAccessFirm(userId, firmId))) {
    throw new Error("You cannot manage this organisation's Xero connections.");
  }

  const { enforceRateLimit } = await import("@/lib/rate-limit.server");
  await enforceRateLimit(`xero:connect:${userId}`, 10, 3600);

  const { data: rows, error } = await supabase
    .from("xero_connections")
    .select("tenant_id")
    .eq("firm_id", firmId);
  if (error) throw new Error(error.message);
  const tenantIds = [...new Set((rows ?? []).map((r: any) => r.tenant_id as string))];

  if (tenantIds.length < 1) throw new Error("This organisation has no Xero files to reconnect.");
  if (tenantIds.length > MAX_BULK_RECONNECT_TENANTS) {
    throw new Error(
      `This organisation has ${tenantIds.length} Xero files, which is more than the ${MAX_BULK_RECONNECT_TENANTS} we can reconnect in one go. Reconnect them one at a time from each client's settings instead.`,
    );
  }

  const state = randomBytes(24).toString("hex");
  const codeVerifier = base64url(randomBytes(48));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const { error: insertError } = await supabase.from("xero_oauth_states").insert({
    state,
    user_id: userId,
    code_verifier: codeVerifier,
    return_origin: normalizeOrigin(origin),
    client_id: null,
    firm_id: firmId,
    flow: "reconnect",
    known_tenant_ids: tenantIds,
    pending_tenant_ids: tenantIds,
  });
  if (insertError) throw new Error(insertError.message);

  const url = new URL(XERO_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", XERO_CALLBACK_URL);
  url.searchParams.set("scope", await xeroRequiredScopeString());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { authorizeUrl: url.toString(), fileCount: tenantIds.length };
}
