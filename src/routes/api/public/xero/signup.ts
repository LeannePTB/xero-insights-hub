import { createFileRoute } from "@tanstack/react-router";
import { randomBytes, createHash } from "crypto";
import { xeroIdentityScopeString } from "@/lib/xero/scopes";
import { siteOrigin, xeroCallbackUrl } from "@/lib/site-origin";
import { enforceRateLimit } from "@/lib/rate-limit.server";

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Sign Up with Xero — connect-request URL (Xero certification checkpoint).
 *
 * PUBLIC ROUTE — pre-session by design. This is the URL the Xero App Store
 * listing and marketing pages point at ("Get this app"). It takes no input,
 * mints a PKCE state row with flow='signup' and no user_id, and redirects to
 * Xero's identity flow (openid profile email only — no accounting scopes).
 * On callback the identity is used only to pre-fill the request-access form;
 * it never creates an account, grants access, or stores tokens.
 *
 * Security: rate limited; the only redirect targets are Xero's authorise URL
 * and the canonical site origin (never a caller-supplied host).
 */
export const Route = createFileRoute("/api/public/xero/signup")({
  server: {
    handlers: {
      GET: async () => {
        const origin = siteOrigin();
        const clientId = process.env.XERO_CLIENT_ID;
        if (!clientId) {
          return Response.redirect(`${origin}/auth?xero_error=not_configured`, 302);
        }

        // Blunt abuse brake: this endpoint writes a state row per call.
        await enforceRateLimit("xero-signup-start:global", 60, 3600);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const state = randomBytes(24).toString("hex");
        const codeVerifier = base64url(randomBytes(48));
        const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

        const { error } = await supabaseAdmin.from("xero_oauth_states").insert({
          state,
          user_id: null,
          code_verifier: codeVerifier,
          return_origin: origin,
          client_id: null,
          flow: "signup",
        });
        if (error) {
          console.error("Xero sign-up: could not store state", error.message);
          return Response.redirect(`${origin}/auth?xero_error=state_store`, 302);
        }

        const url = new URL(XERO_AUTHORIZE_URL);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", xeroCallbackUrl());
        url.searchParams.set("scope", xeroIdentityScopeString());
        url.searchParams.set("state", state);
        url.searchParams.set("code_challenge", codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
        return Response.redirect(url.toString(), 302);
      },
    },
  },
});
