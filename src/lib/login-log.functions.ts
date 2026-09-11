import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Deliberate aal1 exception, approved by the owner on these conditions
// (Phase 1, 11 Sep 2026): no input at all, actor and email taken from the
// verified token, nothing caller-supplied is stored, and it is rate limited
// per user. The login event is recorded at sign-in, before the second factor
// is presented. Write-only, service-role insert, no reads.
export const logLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    const email = (context.claims as any)?.email ?? null;

    // Use service role to insert — clients are blocked from inserting login
    // events directly so they cannot forge email/ip/user_agent values.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed } = await (supabaseAdmin as any).rpc("check_rate_limit", {
      _key: `login_log:${context.userId}`,
      _max: 20,
      _window_seconds: 300,
    });
    if (allowed === false) return { ok: true };

    const { error } = await supabaseAdmin.from("login_events").insert({
      user_id: context.userId,
      email,
      ip,
      user_agent: userAgent,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLoginEvents = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { limit?: number }) => i)
  .handler(async ({ data, context }) => {
    // Authorise: advisors only, decided by public.me_has_role through the
    // caller's own session.
    const { data: isAdvisor } = await (context.supabase as any).rpc("me_has_role", {
      _role: "advisor",
    });
    if (!isAdvisor) {
      throw new Error("Only advisors can view login activity.");
    }

    const limit = Math.min(Math.max(data.limit ?? 200, 1), 500);
    const { data: rows, error } = await context.supabase
      .from("login_events")
      .select("id, user_id, email, ip, user_agent, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    let nameMap = new Map<string, string | null>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    }

    return {
      events: (rows ?? []).map((r: any) => ({
        ...r,
        display_name: r.user_id ? nameMap.get(r.user_id) ?? null : null,
      })),
    };
  });
