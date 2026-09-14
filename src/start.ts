import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { dailySignInCutoff } from "@/lib/session-cutoff";

/**
 * Layer 3 — daily sign-in cut-off.
 *
 * A request carrying a user bearer token is refused when the SESSION behind
 * that token began before the most recent 3am Australia/Sydney, so nobody
 * keeps working on yesterday's sign-in. The reply is a generic 401.
 *
 * Session start comes from the token's `amr` entries (when the password and
 * MFA steps happened); those survive hourly token refreshes, unlike `iat`,
 * which is why `iat` is only a last-resort fallback.
 *
 * The signature is deliberately not verified here: this middleware can only
 * ever DENY, and it is never the sole enforcement —
 * `app_private.assert_aal2()` applies the same cut-off inside the database
 * against `auth.sessions`, so a forged token gains nothing.
 */
function sessionStartedAtMs(bearer: string): number | null {
  const parts = bearer.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ) as { iat?: unknown; amr?: unknown };

    const stamps = Array.isArray(json.amr)
      ? json.amr
          .map((e) =>
            e && typeof e === "object" && typeof (e as { timestamp?: unknown }).timestamp === "number"
              ? (e as { timestamp: number }).timestamp
              : null,
          )
          .filter((n): n is number => n !== null)
      : [];
    if (stamps.length > 0) return Math.min(...stamps) * 1000;
    return typeof json.iat === "number" ? json.iat * 1000 : null;
  } catch {
    return null;
  }
}

const dailySignInMiddleware = createMiddleware().server(async ({ next }) => {
  const header = getRequestHeader("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (bearer) {
    const startedAt = sessionStartedAtMs(bearer);
    if (startedAt !== null && startedAt < dailySignInCutoff().getTime()) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  return await next();
});



const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Layer 4 — security headers on every response.
// HSTS, MIME sniffing, referrer, framing, permissions, and a permissive CSP in
// report-only mode (tightened later once we know what we'd block).
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const h = result.response.headers;
  if (!h.has("strict-transport-security")) {
    h.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  if (!h.has("x-content-type-options")) h.set("x-content-type-options", "nosniff");
  if (!h.has("referrer-policy")) h.set("referrer-policy", "strict-origin-when-cross-origin");
  if (!h.has("x-frame-options")) h.set("x-frame-options", "DENY");
  if (!h.has("permissions-policy")) {
    h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  }
  if (!h.has("content-security-policy-report-only")) {
    h.set(
      "content-security-policy-report-only",
      [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.xero.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
