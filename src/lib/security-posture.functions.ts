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
  name: string;
  isSuperAdmin: boolean;
  hasMfa: boolean;
  lastSeenAt: string;
};

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
    const checks: PostureCheck[] = (data?.checks ?? []) as PostureCheck[];
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
      name: r.display_name || r.email || "Unknown",
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
