import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * The daily sign-in cut-off that used to live here (Layer 3) was REMOVED by
 * owner decision on 15 September 2026: the inactivity timeout below addresses
 * the stolen-device threat directly, while a daily forced sign-in added
 * friction without covering it. A session is no longer refused for having
 * begun yesterday.
 */



/**
 * Layer 3b - inactivity timeout at the request layer.
 *
 * The control is the SERVER-HELD timestamp: `public.session_is_active()` reads
 * `session_activity.last_activity_at` (written only by the aal2, caller-scoped
 * `touch_session_activity()`) and compares it with the 30 minute window. Nothing
 * from the browser is trusted here - only the bearer token is passed through, and
 * the database answers.
 *
 * A positive answer is cached for 15 seconds per isolate to keep dashboards
 * quick; a refusal is never cached, and the same check runs again inside the
 * database on every query and every definer function, so caching can only ever
 * delay a refusal by seconds, never prevent one.
 */
const activeCache = new Map<string, number>();
const ACTIVE_CACHE_MS = 15_000;

async function sessionIsActiveForBearer(bearer: string): Promise<boolean> {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return true; // no way to ask: the database still enforces
  const cached = activeCache.get(bearer);
  if (cached !== undefined && cached > Date.now()) return true;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/session_is_active`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return true; // unreachable or not applicable: the database enforces
    const active = (await res.text()).trim() === "true";
    if (active) {
      activeCache.set(bearer, Date.now() + ACTIVE_CACHE_MS);
      if (activeCache.size > 500) activeCache.clear();
    }
    return active;
  } catch {
    return true;
  }
}

/**
 * SUSPENDED 15 Sep 2026 (outage). Nothing was recording activity, so this check
 * — like the database one — refused people who were actively using the app the
 * moment their sign-in passed 30 minutes. It is left here, deliberately inert,
 * and will be switched back on in the same change that proves an actively used
 * session is still accepted after 30 minutes. Until then the inactivity timeout
 * is browser-side only, and the browser can only ever end a session EARLIER.
 */
const ENFORCE_INACTIVITY_AT_REQUEST_LAYER = false;

const inactivityMiddleware = createMiddleware().server(async ({ next }) => {
  if (!ENFORCE_INACTIVITY_AT_REQUEST_LAYER) return await next();
  const header = getRequestHeader("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (bearer && !(await sessionIsActiveForBearer(bearer))) {
    // A distinct marker: idle is not an MFA problem.
    return new Response("SESSION_IDLE", { status: 401, headers: { "x-session-state": "idle" } });
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
  requestMiddleware: [errorMiddleware, inactivityMiddleware, securityHeadersMiddleware],
}));
