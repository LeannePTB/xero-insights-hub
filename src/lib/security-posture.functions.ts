import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

export type PostureStatus = "ok" | "warn" | "action";

export type PostureCheck = {
  id: string;
  title: string;
  status: PostureStatus;
  detail: string;
  evidence: string;
  /** definer_guards only: which guard name matched in each callable function. */
  matches?: { fn: string; pattern: string }[];
  /**
   * Set only on checks in ATTESTABLE_CHECKS: controls no system can read, where
   * the only honest evidence is a recorded human confirmation. Never set on a
   * check the server can read for itself.
   */
  attestable?: {
    checkKey: string;
    /** What the person is asserting when they press Confirm. */
    claim: string;
    confirmedByEmail?: string | null;
    confirmedAt?: string | null;
    note?: string | null;
    expiresAfterDays?: number;
  };
};

/**
 * The ONLY checks an attestation may answer. A check the server can read must
 * never appear here — an attestation can never override a machine reading.
 */
export const ATTESTABLE_CHECKS: Record<string, { claim: string }> = {
  leaked_password: {
    claim:
      "I have opened the backend authentication settings myself and confirmed that leaked-password protection (Have I Been Pwned) is switched on.",
  },
};

export type PostureResult = {
  generatedAt: string;
  checks: PostureCheck[];
  ok: number;
  warn: number;
  action: number;
};

export type OnlineUser = {
  userId: string;
  displayName: string | null;
  email: string | null;
  isSuperAdmin: boolean;
  hasMfa: boolean;
  lastSeenAt: string;
};

/**
 * Checks the database cannot see, merged into the SAME list so the sidebar and
 * /admin/security always show identical results. Server-side only; nothing here
 * returns a secret value, only whether it is present and usable.
 */
type Attestation = {
  check_key: string;
  confirmed_by_email: string | null;
  confirmed_at: string;
  note: string | null;
  expires_after_days: number;
};

async function serverConfigChecks(attestations: Attestation[]): Promise<PostureCheck[]> {
  const out: PostureCheck[] = [];

  // Token encryption key — proven by a real round trip, never echoed.
  try {
    const { encryptToken, decryptToken } = await import("@/lib/crypto.server");
    const probe = "posture-probe";
    const ok = decryptToken(encryptToken(probe)) === probe;
    out.push({
      id: "token_enc_key",
      title: "Xero token encryption key is usable",
      status: ok ? "ok" : "action",
      detail: ok
        ? "The server holds a working key for encrypting Xero tokens at rest."
        : "The encryption key is present but did not round-trip.",
      evidence: "AES-256-GCM encrypt/decrypt round trip performed on the server",
    });
  } catch {
    out.push({
      id: "token_enc_key",
      title: "Xero token encryption key is usable",
      status: "action",
      detail: "No usable token encryption key is configured on the server.",
      evidence: "TOKEN_ENC_KEY missing or the wrong length (round trip failed)",
    });
  }

  // TLS / HSTS — verified against the canonical public origin.
  const { siteOrigin } = await import("@/lib/site-origin");
  const origin = siteOrigin();
  try {
    const res = await fetch(origin, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    const hsts = res.headers.get("strict-transport-security");
    const https = origin.startsWith("https://");
    out.push({
      id: "tls_hsts",
      title: "HTTPS with HSTS",
      status: https && hsts ? "ok" : "warn",
      detail:
        https && hsts
          ? "The public site is served over HTTPS and sends a strict transport header."
          : `Not verified — confirm manually at ${origin} (response headers must include strict-transport-security).`,
      evidence: `HEAD ${origin} → ${res.status}; strict-transport-security: ${hsts ?? "absent"}`,
    });
  } catch {
    out.push({
      id: "tls_hsts",
      title: "HTTPS with HSTS",
      status: "warn",
      detail: `Not verified — confirm manually at ${origin} (response headers must include strict-transport-security).`,
      evidence: "The server could not reach the public origin to read its headers",
    });
  }

  // Leaked-password protection is an auth provider setting the app cannot read.
  out.push({
    id: "hibp",
    title: "Leaked password protection",
    status: "warn",
    detail:
      "Not verified — confirm manually in the backend authentication settings, under password protection (Have I Been Pwned).",
    evidence: "No server-readable source for this setting",
  });

  return out;
}

/**
 * Single source of truth for the posture checks: `public.security_posture()`
 * is SECURITY DEFINER and asserts aal2 + `app_private.me_is_super_admin()`
 * as its first statements, so authorisation lives in the database (rule 6).
 * Called through `context.supabase`, never `supabaseAdmin`.
 */
export const getSecurityChecks = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<PostureResult> => {
    const { data, error } = await (context.supabase as any).rpc("security_posture");
    if (error) throw new Error("Security posture unavailable");

    // Phase 6 read-audit check. Same authorisation pattern: a definer function
    // that asserts aal2 + super admin itself, called through context.supabase.
    // Computed from the trail and from figures actually served, not a fixed list.
    let readAudit: PostureCheck[] = [];
    const readRes = await (context.supabase as any).rpc("read_audit_posture");
    if (!readRes.error && readRes.data) readAudit = [readRes.data as PostureCheck];

    // The live-suite containment check is appended by `security_posture()`
    // itself, so it must NOT be fetched again here — doing so rendered
    // "Security test accounts are contained" twice on the card.

    const checks: PostureCheck[] = [
      ...((data?.checks ?? []) as PostureCheck[]),
      ...readAudit,
      ...(await serverConfigChecks()),
    ];
    return {
      generatedAt: (data?.generated_at as string) ?? new Date().toISOString(),
      checks,
      ok: checks.filter((c) => c.status === "ok").length,
      warn: checks.filter((c) => c.status === "warn").length,
      action: checks.filter((c) => c.status === "action").length,
    };
  });

export const getOnlineUsers = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<OnlineUser[]> => {
    const { data, error } = await (context.supabase as any).rpc("online_users", {
      _window_minutes: 5,
    });
    if (error) throw new Error("Presence unavailable");
    return ((data ?? []) as any[]).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name ?? null,
      email: r.email ?? null,
      isSuperAdmin: !!r.is_super_admin,
      hasMfa: !!r.has_mfa,
      lastSeenAt: r.last_seen_at,
    }));
  });

/** Records only the caller's own last-seen time; RLS scopes it to their row. */
export const recordPresence = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_presence" as any)
      .upsert(
        { user_id: context.userId, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error("Presence not recorded");
    return { ok: true };
  });
