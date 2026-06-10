import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const SCOPES = [
  "offline_access",
  "accounting.reports.profitandloss.read",
  "accounting.reports.balancesheet.read",
  "accounting.invoices.read",
].join(" ");

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

function normalizeOrigin(origin: string) {
  const parsed = new URL(origin);
  if (parsed.hostname === "localhost") return parsed.origin;

  const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
  const allowedHosts = projectId
    ? new Set([
        `${projectId}.lovableproject.com`,
        `id-preview--${projectId}.lovable.app`,
        `project--${projectId}.lovable.app`,
        `project--${projectId}-dev.lovable.app`,
      ])
    : new Set<string>();

  if (parsed.protocol === "https:" && allowedHosts.has(parsed.hostname)) {
    return parsed.origin;
  }

  throw new Error("Invalid app origin for Xero connection.");
}

function getXeroRedirectOrigin(returnOrigin: string) {
  const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
  const parsed = new URL(returnOrigin);
  if (projectId && (parsed.hostname.endsWith(".lovableproject.com") || parsed.hostname === `project--${projectId}-dev.lovable.app`)) {
    return `https://id-preview--${projectId}.lovable.app`;
  }
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
