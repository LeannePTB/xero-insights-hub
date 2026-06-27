import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes, createHash } from "crypto";
import { DEFAULT_XERO_SCOPE_SET, xeroScopeString, xeroStateForScopeSet } from "@/lib/xero/scopes";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}


const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const CANONICAL_XERO_APP_ORIGIN = "https://tractionadvisory.app";
const XERO_CALLBACK_URL = `${CANONICAL_XERO_APP_ORIGIN}/api/public/xero/callback`;
const SCOPES = xeroScopeString(DEFAULT_XERO_SCOPE_SET);

export const listXeroConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("xero_connections")
      .select("id, tenant_id, tenant_name, tenant_type, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { connections: data ?? [] };
  });

export const checkXeroConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data }) => {
    const { getConnectionByTenant } = await import("@/lib/xero/api.server");
    try {
      await getConnectionByTenant(data.tenantId);
      return { ok: true as const, needsReconnect: false as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      const needsReconnect =
        lower.includes("reconnect required") ||
        lower.includes("invalid_grant") ||
        lower.includes("missing tokens") ||
        lower.includes("connection not found");
      return { ok: false as const, needsReconnect, message: msg };
    }
  });

export const startXeroConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string; clientId?: string }) => input)
  .handler(async ({ data, context }) => {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error("Xero is not configured yet. The app owner needs to add XERO_CLIENT_ID and XERO_CLIENT_SECRET.");
    }

    // Rate limit: 10 Xero connect starts per user per hour.
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(`xero:connect:${context.userId}`, 10, 3600);

    // Enforce tier-based connection hard-cap and access state before starting OAuth.
    const { computeFirmAccess } = await import("@/lib/access.functions");
    const access = await computeFirmAccess(context.userId);
    if (access.state === "locked") {
      throw new Error("Your subscription is not active. Update billing before connecting another Xero file.");
    }
    if (access.state !== "no_firm" && access.connectionCount >= access.connectionLimit) {
      throw new Error(
        `You've reached your plan limit of ${access.connectionLimit} Xero file${access.connectionLimit === 1 ? "" : "s"}. Upgrade your plan to connect more.`,
      );
    }

    const state = xeroStateForScopeSet(DEFAULT_XERO_SCOPE_SET, randomBytes(24).toString("hex"));
    // OAuth 2.0 PKCE (S256) — required by Xero security standard.
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnOrigin = normalizeOrigin(data.origin);
    const { error } = await context.supabase
      .from("xero_oauth_states")
      .insert({
        state,
        user_id: context.userId,
        code_verifier: codeVerifier,
        return_origin: returnOrigin,
        client_id: data.clientId ?? null,
      });
    if (error) throw new Error(error.message);

    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", XERO_CALLBACK_URL);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    console.info("Starting Xero OAuth", { redirectUri: XERO_CALLBACK_URL, returnOrigin });
    return { authorizeUrl: url.toString() };

  });

const ALLOWED_CUSTOM_HOSTS = new Set([
  "tractionadvisory.app",
  "www.tractionadvisory.app",
]);

function normalizeOrigin(origin: string) {
  const parsed = new URL(origin);
  if (parsed.hostname === "localhost") return parsed.origin;
  if (parsed.protocol !== "https:") {
    throw new Error("Invalid app origin for Xero connection.");
  }

  const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
  const allowedHosts = new Set<string>(ALLOWED_CUSTOM_HOSTS);
  if (projectId) {
    allowedHosts.add(`${projectId}.lovableproject.com`);
    allowedHosts.add(`id-preview--${projectId}.lovable.app`);
    allowedHosts.add(`project--${projectId}.lovable.app`);
    allowedHosts.add(`project--${projectId}-dev.lovable.app`);
  }

  // Allow any *.lovable.app host (covers published slug subdomains).
  if (parsed.hostname.endsWith(".lovable.app")) return CANONICAL_XERO_APP_ORIGIN;
  if (allowedHosts.has(parsed.hostname)) return CANONICAL_XERO_APP_ORIGIN;

  throw new Error("Invalid app origin for Xero connection.");
}

export const disconnectXero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("xero_connections")
      .delete()
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
