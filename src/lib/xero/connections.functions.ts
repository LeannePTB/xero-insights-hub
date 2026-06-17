import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const SCOPES_ARRAY = [
  "offline_access",
  "accounting.reports.profitandloss.read",
  "accounting.reports.balancesheet.read",
  "accounting.reports.taxreports.read",
  "accounting.invoices.read",
];
// Hard guarantee: Xero remains read-only. Any non-`.read` scope (other than the
// `offline_access` refresh-token grant) must never be requested. If this throws
// at boot, refuse to build the URL — fail closed.
for (const s of SCOPES_ARRAY) {
  if (s !== "offline_access" && !s.endsWith(".read")) {
    throw new Error(`Forbidden Xero scope detected: ${s}. Only *.read scopes are allowed.`);
  }
}
const SCOPES = SCOPES_ARRAY.join(" ");

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

export const startXeroConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
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

    const state = randomBytes(24).toString("hex");
    const returnOrigin = normalizeOrigin(data.origin);
    const { error } = await context.supabase
      .from("xero_oauth_states")
      .insert({ state, user_id: context.userId, code_verifier: returnOrigin });
    if (error) throw new Error(error.message);

    const redirectOrigin = getXeroRedirectOrigin(returnOrigin);
    const redirectUri = `${redirectOrigin}/api/public/xero/callback`;
    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
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
  if (parsed.hostname.endsWith(".lovable.app")) return parsed.origin;
  if (allowedHosts.has(parsed.hostname)) return parsed.origin;

  throw new Error("Invalid app origin for Xero connection.");
}

function getXeroRedirectOrigin(returnOrigin: string) {
  const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
  const parsed = new URL(returnOrigin);
  // Local dev keeps its own callback (must be registered in Xero separately).
  if (parsed.hostname === "localhost") return returnOrigin;
  // Everything else routes through the stable id-preview callback that's
  // registered in the Xero app, then the callback redirects back to returnOrigin.
  if (projectId) return `https://id-preview--${projectId}.lovable.app`;
  return returnOrigin;
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
