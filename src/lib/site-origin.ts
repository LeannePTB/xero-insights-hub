/**
 * Single source of truth for the app's canonical public origin.
 *
 * Everything that needs an absolute URL — the Xero OAuth redirect, invite and
 * password links, report links, sign-in instructions — reads from here so the
 * value can never drift between call sites again.
 *
 * Resolution order (first non-empty wins):
 *   1. SITE_URL            — server-only environment variable
 *   2. VITE_SITE_URL       — readable on both server and client
 *   3. https://tractionadvisory.app  — hardcoded fallback
 *
 * NOTE: this module is imported from client-reachable code, so `process.env`
 * is accessed defensively — it does not exist in the browser.
 *
 * The email SENDING identity (notify.tractionadvisory.com.au) is deliberately
 * a different domain and is NOT configured here.
 */

const FALLBACK_ORIGIN = "https://tractionadvisory.app";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

/**
 * The canonical origin, with no trailing slash — e.g. `https://tractionadvisory.app`.
 * A function, not a module-scope constant: on Cloudflare Workers env binds at
 * request time, so a module-scope read would resolve to undefined.
 */
export function siteOrigin(): string {
  let fromEnv: string | undefined;
  try {
    fromEnv =
      (typeof process !== "undefined" ? process.env?.["SITE_URL"] : undefined) ||
      (typeof process !== "undefined" ? process.env?.["VITE_SITE_URL"] : undefined);
  } catch {
    fromEnv = undefined;
  }
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta as any).env?.VITE_SITE_URL
      : undefined;

  const raw = (fromEnv || fromVite || FALLBACK_ORIGIN).toString().trim();
  return trimTrailingSlashes(raw) || FALLBACK_ORIGIN;
}

/** Build an absolute app URL, e.g. siteUrl("/auth"). */
export function siteUrl(path = "/"): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The exact string registered as the Xero app's redirect URI. Xero matches it
 * character for character on BOTH the authorise request and the token
 * exchange, so every call site must use this one value.
 */
export function xeroCallbackUrl(): string {
  return `${siteOrigin()}/api/public/xero/callback`;
}

/** Host of the canonical origin, e.g. `tractionadvisory.app`. */
export function siteHost(): string {
  try {
    return new URL(siteOrigin()).hostname;
  } catch {
    return new URL(FALLBACK_ORIGIN).hostname;
  }
}
