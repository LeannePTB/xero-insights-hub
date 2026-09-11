import { createServerFn } from "@tanstack/react-start";
import { randomBytes, createHash } from "crypto";
import { xeroIdentityScopeString } from "@/lib/xero/scopes";
import { xeroCallbackUrl, assertAppOrigin } from "@/lib/site-origin";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const IDENTITY_SCOPES = xeroIdentityScopeString();

/**
 * Sign In with Xero (Xero certification checkpoint 1).
 *
 * SYSTEM CONTEXT — pre-session. Unauthenticated by design: anyone visiting
 * /auth can call it, before any session exists. It mints a PKCE state row with
 * flow='signin' and no user_id, then redirects to Xero's identity flow. On
 * callback the returned id_token's email is matched against an existing invited
 * user; unknown emails are rejected (invite-only).
 *
 * It lives in its own file so the rest of the Xero connection code can be held
 * to the rule that a privileged step must follow a database authorisation call.
 * Nothing caller-supplied is trusted here beyond the app origin, which
 * assertAppOrigin validates against the allowed origins. No data is returned
 * other than the Xero authorise URL.
 */
export const startXeroSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data }) => {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error("Sign In with Xero is not configured yet.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const state = randomBytes(24).toString("hex");
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnOrigin = assertAppOrigin(data.origin);

    const { error } = await supabaseAdmin.from("xero_oauth_states").insert({
      state,
      user_id: null,
      code_verifier: codeVerifier,
      return_origin: returnOrigin,
      client_id: null,
      flow: "signin",
    });
    if (error) throw new Error(error.message);

    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", xeroCallbackUrl());
    url.searchParams.set("scope", IDENTITY_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizeUrl: url.toString() };
  });
