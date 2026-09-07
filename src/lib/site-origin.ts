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
 *   3. https://tractionadvisory.com.au  — hardcoded fallback
 *
 * NOTE: this module is imported from client-reachable code, so `process.env`
 * is accessed defensively — it does not exist in the browser.
 *
 * The email SENDING identity (notify.tractionadvisory.com.au) is deliberately
 * a different domain and is NOT configured here.
 */

const FALLBACK_ORIGIN = "https://tractionadvisory.com.au";

/**
 * Origins we used to be canonical on. They are STILL accepted as valid app
 * origins on OAuth return paths so anything already in flight resolves, but
 * they are never generated. Removed in a later cleanup.
 */
const LEGACY_APP_HOSTS = ["tractionadvisory.app", "www.tractionadvisory.app"];

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

/**
 * The published slug host assigned to this project on Lovable, from the
 * project's published URL (xero-shine-dashboards.lovable.app). Explicit, not
 * a wildcard: anyone can publish to *.lovable.app, so the parent domain must
 * never be trusted.
 */
const PUBLISHED_SLUG_HOSTS = ["xero-shine-dashboards.lovable.app"];

/** True outside production builds (dev server / preview SSR). */
function isNonProduction(): boolean {
  try {
    if (typeof process !== "undefined" && process.env?.["NODE_ENV"]) {
      return process.env["NODE_ENV"] !== "production";
    }
  } catch {
    // ignore
  }
  try {
    const viteDev = (import.meta as any).env?.DEV;
    if (typeof viteDev === "boolean") return viteDev;
  } catch {
    // ignore
  }
  return false;
}

/**
 * The exact set of hostnames accepted as legitimate app origins on OAuth
 * return paths. Built per call: env binds at request time on the Worker
 * runtime. Never widen this to a wildcard — *.lovable.app is open to anyone,
 * and neither the canonical domain nor the legacy one is ever wildcarded.
 *
 * Sources:
 *   - siteHost()                    → tractionadvisory.com.au (canonical)
 *   - its `www.` form               → the other name DNS serves
 *   - LEGACY_APP_HOSTS              → tractionadvisory.app, still accepted
 *   - PUBLISHED_SLUG_HOSTS          → this project's published Lovable URL
 *   - LOVABLE_PROJECT_ID-derived    → this project's own preview hosts
 *   - localhost                     → non-production only
 */
export function allowedAppHosts(): Set<string> {
  const canonical = siteHost();
  const hosts = new Set<string>([
    canonical,
    canonical.startsWith("www.") ? canonical.slice(4) : `www.${canonical}`,
    ...LEGACY_APP_HOSTS,
    ...PUBLISHED_SLUG_HOSTS,
  ]);
  let projectId: string | undefined;
  try {
    projectId =
      typeof process !== "undefined"
        ? (process.env?.["LOVABLE_PROJECT_ID"] ?? process.env?.["__LOVABLE_PROJECT_ID"])
        : undefined;
  } catch {
    projectId = undefined;
  }
  if (projectId) {
    hosts.add(`${projectId}.lovableproject.com`);
    hosts.add(`id-preview--${projectId}.lovable.app`);
    hosts.add(`project--${projectId}.lovable.app`);
    hosts.add(`project--${projectId}-dev.lovable.app`);
  }
  if (isNonProduction()) hosts.add("localhost");
  return hosts;
}

/**
 * Validate a caller-supplied app origin used on OAuth return paths.
 *
 * Single implementation, shared by every place that stores a `return_origin`
 * (`connections.functions.ts` and `reconnect-all.server.ts`). Rejects rather
 * than falling back: a caller sending an unrecognised origin is an anomaly.
 *
 * Returns the canonical `siteOrigin()` for any accepted non-localhost host,
 * so the value stored in `xero_oauth_states.return_origin` is always ours.
 */
export function assertAppOrigin(origin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("Invalid app origin for Xero connection.");
  }
  const allowedHosts = allowedAppHosts();
  if (parsed.hostname === "localhost" && allowedHosts.has("localhost")) return parsed.origin;
  if (parsed.protocol !== "https:") {
    throw new Error("Invalid app origin for Xero connection.");
  }
  if (allowedHosts.has(parsed.hostname)) return siteOrigin();
  throw new Error("Invalid app origin for Xero connection.");
}
