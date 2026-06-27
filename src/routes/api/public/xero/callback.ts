import { createFileRoute } from "@tanstack/react-router";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const XERO_CALLBACK_URL = "https://tractionadvisory.app/api/public/xero/callback";

export const Route = createFileRoute("/api/public/xero/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const origin = `${url.protocol}//${url.host}`;
        let returnOrigin = origin;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let stateRow: {
          user_id: string;
          code_verifier: string | null;
          return_origin: string | null;
          created_at: string | null;
        } | null = null;

        if (state) {
          const { data, error: stateLookupErr } = await supabaseAdmin
            .from("xero_oauth_states")
            .select("user_id, code_verifier, return_origin, created_at")
            .eq("state", state)
            .maybeSingle();
          if (!stateLookupErr && data) {
            stateRow = data;
            returnOrigin = getSafeReturnOrigin(data.return_origin, data.code_verifier, origin);
          }
        }

        if (error) {
          console.error("Xero authorization failed", { error, callbackOrigin: origin, returnOrigin });
          if (state) await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
          return redirectTo(`${returnOrigin}/dashboard?xero_error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) return redirectTo(`${returnOrigin}/dashboard?xero_error=missing_params`);

        const clientId = process.env.XERO_CLIENT_ID;
        const clientSecret = process.env.XERO_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return redirectTo(`${returnOrigin}/dashboard?xero_error=not_configured`);
        }

        const { encryptTokenB64 } = await import("@/lib/crypto.server");

        // Look up the user this state belongs to. Enforce 15-min single-use.
        if (!stateRow) {
          return redirectTo(`${returnOrigin}/dashboard?xero_error=invalid_state`);
        }
        if (stateRow.created_at && Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60 * 1000) {
          await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
          return redirectTo(`${returnOrigin}/dashboard?xero_error=state_expired`);
        }
        const userId = stateRow.user_id;
        const codeVerifier: string | null = stateRow.code_verifier ?? null;
        await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);

        const tokenBody: Record<string, string> = {
          grant_type: "authorization_code",
          code,
          redirect_uri: XERO_CALLBACK_URL,
        };
        // Send the PKCE verifier only when it looks like an actual verifier
        // (43-128 chars, no scheme prefix) — legacy rows hold a URL here.
        if (
          codeVerifier &&
          !codeVerifier.startsWith("https://") &&
          codeVerifier.length >= 43 &&
          codeVerifier.length <= 128
        ) {
          tokenBody.code_verifier = codeVerifier;
        }

        const tokenRes = await fetch(XERO_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams(tokenBody),
        });
        if (!tokenRes.ok) {
          const t = await tokenRes.text();
          console.error("Xero token exchange failed", { status: tokenRes.status, body: t, redirectUri: XERO_CALLBACK_URL });
          return redirectTo(`${returnOrigin}/dashboard?xero_error=token_exchange`);
        }
        const tokens = await tokenRes.json() as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          scope: string;
        };

        // Fetch tenants
        const tenantsRes = await fetch(XERO_CONNECTIONS_URL, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!tenantsRes.ok) {
          return redirectTo(`${returnOrigin}/dashboard?xero_error=tenants_lookup`);
        }
        const tenants = await tenantsRes.json() as Array<{
          tenantId: string;
          tenantName: string;
          tenantType: string;
        }>;

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
        let accessEnc: string;
        let refreshEnc: string;
        try {
          accessEnc = encryptTokenB64(tokens.access_token);
          refreshEnc = encryptTokenB64(tokens.refresh_token);
        } catch (storageErr) {
          console.error("Xero token encryption failed", storageErr);
          return redirectTo(`${returnOrigin}/dashboard?xero_error=token_storage`);
        }
        const rows = tenants.map((t) => ({
          user_id: userId,
          tenant_id: t.tenantId,
          tenant_name: t.tenantName,
          tenant_type: t.tenantType,
          access_token: null,
          refresh_token: null,
          access_token_enc: accessEnc,
          refresh_token_enc: refreshEnc,
          expires_at: expiresAt,
          scopes: tokens.scope,
        }));

        if (rows.length > 0) {
          const { error: upsertErr } = await supabaseAdmin
            .from("xero_connections")
            .upsert(rows, { onConflict: "user_id,tenant_id" });
          if (upsertErr) {
            console.error("xero_connections upsert failed", upsertErr);
            return redirectTo(`${returnOrigin}/dashboard?xero_error=db`);
          }

          // Audit-log the successful connection.
          await supabaseAdmin.from("audit_log").insert(
            tenants.map((t) => ({
              actor_user_id: userId,
              action: "xero_connected",
              target_type: "xero_connection",
              target_id: t.tenantId,
              meta: { tenant_name: t.tenantName, scopes: tokens.scope },
            })),
          );
        }

        return redirectTo(`${returnOrigin}/dashboard?xero=connected`);
      },
    },
  },
});

function redirectTo(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

const ALLOWED_RETURN_HOSTS = new Set([
  "tractionadvisory.app",
  "www.tractionadvisory.app",
  "xero-shine-dashboards.lovable.app",
]);

function getSafeReturnOrigin(returnOrigin: string | null, legacyCodeVerifier: string | null, fallback: string) {
  // Prefer the new return_origin column; tolerate legacy rows that overloaded
  // code_verifier with the return origin until they expire.
  const candidates = [returnOrigin, legacyCodeVerifier];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.startsWith("https://")) continue;
    try {
      const parsed = new URL(candidate);
      if (ALLOWED_RETURN_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".lovable.app")) {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed stored origins and fall back to the callback origin.
    }
  }
  return fallback;
}
