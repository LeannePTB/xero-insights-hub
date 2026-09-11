import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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

