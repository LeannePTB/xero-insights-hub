import { createFileRoute } from "@tanstack/react-router";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

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

        if (error) return redirectTo(`${origin}/dashboard?xero_error=${encodeURIComponent(error)}`);
        if (!code || !state) return redirectTo(`${origin}/dashboard?xero_error=missing_params`);

        const clientId = process.env.XERO_CLIENT_ID;
        const clientSecret = process.env.XERO_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return redirectTo(`${origin}/dashboard?xero_error=not_configured`);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Look up the user this state belongs to
        const { data: stateRow, error: stateErr } = await supabaseAdmin
          .from("xero_oauth_states")
          .select("user_id, code_verifier")
          .eq("state", state)
          .maybeSingle();
        if (stateErr || !stateRow) {
          return redirectTo(`${origin}/dashboard?xero_error=invalid_state`);
        }
        const userId = stateRow.user_id;
        if (typeof stateRow.code_verifier === "string" && stateRow.code_verifier.startsWith("https://")) {
          returnOrigin = stateRow.code_verifier;
        }
        await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);

        const redirectUri = `${origin}/api/public/xero/callback`;
        const tokenRes = await fetch(XERO_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });
        if (!tokenRes.ok) {
          const t = await tokenRes.text();
          console.error("Xero token exchange failed", tokenRes.status, t);
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
        const rows = tenants.map((t) => ({
          user_id: userId,
          tenant_id: t.tenantId,
          tenant_name: t.tenantName,
          tenant_type: t.tenantType,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
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
        }

        return redirectTo(`${returnOrigin}/dashboard?xero=connected`);
      },
    },
  },
});

function redirectTo(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}
