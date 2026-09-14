import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { dailySignInCutoff } from "@/lib/session-cutoff";

/**
 * Layer 3 — daily sign-in cut-off.
 *
 * Every request that carries a user bearer token is refused when that token was
 * issued before the most recent 3am Australia/Sydney, so nobody keeps working
 * on yesterday's sign-in. The reply is a generic 401 that leaks nothing.
 *
 * `iat` is read without verifying the signature on purpose: this middleware can
 * only ever DENY. It is never the sole enforcement — app_private.assert_aal2()
 * applies the same cut-off inside the database against auth.sessions, so a
 * forged or re-signed token gains nothing.
 */
function tokenIssuedAtMs(bearer: string): number | null {
  const parts = bearer.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ) as { iat?: unknown };
    return typeof payload && typeof (json.iat) === "number" ? json.iat * 1000 : null;
  } catch {
    return null;
  }
}

const dailySignInMiddleware = createMiddleware().server(async ({ next }) => {
  const header = getRequestHeader("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (bearer) {
    const issuedAt = tokenIssuedAtMs(bearer);
    if (issuedAt !== null && issuedAt < dailySignInCutoff().getTime()) {
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
