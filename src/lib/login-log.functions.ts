import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const logLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    const email = (context.claims as any)?.email ?? null;

    const { error } = await context.supabase.from("login_events").insert({
      user_id: context.userId,
      email,
      ip,
      user_agent: userAgent,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLoginEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number }) => i)
  .handler(async ({ data, context }) => {
    // Authorize: advisors only
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!roles || roles.length === 0) {
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
