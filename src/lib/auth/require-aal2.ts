import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side MFA enforcement (security rule 2).
 *
 * `requireSupabaseAuth` is auto-generated and only proves the bearer token is
 * valid; it accepts a password-only (aal1) session, including the aal1 session
 * minted by "Sign in with Xero". This wrapper adds the assurance-level check so
 * no organisation, client, Xero, audit or personal data is reachable without a
 * verified second factor. `MfaGate` in the browser is UX only, never the
 * control.
 *
 * The database enforces the same rule independently through
 * `app_private.is_aal2()` in RESTRICTIVE policies and definer-function guards.
 */
export const requireAal2 = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const aal = (context.claims as { aal?: unknown } | null)?.aal;
    if (aal !== "aal2") {
      throw new Error("Unauthorized: multi-factor authentication required");
    }
    return next();
  });
