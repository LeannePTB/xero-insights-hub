import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

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
