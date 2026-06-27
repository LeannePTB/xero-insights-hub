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
        const rawErrorDescription = url.searchParams.get("error_description");
        const origin = `${url.protocol}//${url.host}`;
        let returnOrigin = origin;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let stateRow: {
          user_id: string;
          code_verifier: string | null;
          return_origin: string | null;
          created_at: string | null;
          client_id: string | null;
        } | null = null;

        if (state) {
          const { data, error: stateLookupErr } = await supabaseAdmin
            .from("xero_oauth_states")
            .select("user_id, code_verifier, return_origin, created_at, client_id")
            .eq("state", state)
            .maybeSingle();
          if (!stateLookupErr && data) {
            stateRow = data;
            returnOrigin = getSafeReturnOrigin(data.return_origin, data.code_verifier, origin);
          }
        }

        if (error) {
          const errorDescription = rawErrorDescription ?? "";
          console.error("Xero authorization failed", { error, errorDescription, callbackOrigin: origin, returnOrigin });
          if (state) await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
          const message =
            error === "invalid_scope"
              ? `Xero rejected the requested read-only permissions${errorDescription ? ` (${errorDescription})` : ""}. The app now requests Xero's current granular Accounting API read scopes; please check those scopes are assigned to the Xero app, then try Reconnect again.`
              : error;
          const errorPath = stateRow?.client_id ? `/clients/${stateRow.client_id}/settings` : "/dashboard";
          return redirectTo(`${returnOrigin}${errorPath}?xero_error=${encodeURIComponent(message)}`);
        }
        if (!code || !state) return redirectTo(`${returnOrigin}/dashboard?xero_error=missing_params`);

        const clientSecret = process.env.XERO_CLIENT_SECRET;
        const clientId = process.env.XERO_CLIENT_ID;
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
          status: "connected",
          disconnected_at: null,
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

        // If the OAuth started from a client settings page, auto-link the new
        // org(s) to that client and redirect back there.
        const initiatingClientId = stateRow.client_id ?? null;
        if (initiatingClientId && tenants.length > 0) {
          // Look up the new connection ids for this user + tenants.
          const tenantIds = tenants.map((t) => t.tenantId);
          const { data: conns } = await supabaseAdmin
            .from("xero_connections")
            .select("id, tenant_id")
            .eq("user_id", userId)
            .in("tenant_id", tenantIds);

          // Enforce the same multi-company guard as attachXeroOrg.
          const { data: existingLinks } = await supabaseAdmin
            .from("client_xero_orgs")
            .select("xero_connection_id")
            .eq("client_id", initiatingClientId);
          const existingCount = existingLinks?.length ?? 0;
          const alreadyLinkedIds = new Set((existingLinks ?? []).map((r) => r.xero_connection_id));

          let isMulti = false;
          if (existingCount >= 1) {
            const { data: tiers } = await supabaseAdmin
              .from("client_access")
              .select("tier")
              .eq("client_id", initiatingClientId);
            isMulti = (tiers ?? []).some((r) => r.tier === "multi_company");
          }

          const newConnIds = (conns ?? [])
            .map((c) => c.id)
            .filter((id) => !alreadyLinkedIds.has(id));

          if (newConnIds.length > 0) {
            if (existingCount >= 1 && !isMulti) {
              return redirectTo(`${returnOrigin}/clients/${initiatingClientId}/settings?xero_error=multi_company_required`);
            }
            const linkRows = newConnIds.map((cid) => ({
              client_id: initiatingClientId,
              xero_connection_id: cid,
            }));
            const { error: linkErr } = await supabaseAdmin
              .from("client_xero_orgs")
              .insert(linkRows);
            if (linkErr) {
              console.error("client_xero_orgs auto-link failed", linkErr);
              return redirectTo(`${returnOrigin}/clients/${initiatingClientId}/settings?xero_error=link_failed`);
            }
          }

          return redirectTo(`${returnOrigin}/clients/${initiatingClientId}/settings?xero=connected`);
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
