import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdvisor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "advisor");
  if (!data || data.length === 0) throw new Error("Only advisors can manage advisors.");
}

export const listAdvisors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdvisor(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, created_at")
      .eq("role", "advisor")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows?.length) return { advisors: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", rows.map((r) => r.user_id));
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      advisors: rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        email: map.get(r.user_id)?.email ?? null,
        display_name: map.get(r.user_id)?.display_name ?? null,
        is_self: r.user_id === context.userId,
      })),
    };
  });

export const inviteAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Please enter a valid email address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    let userId = existing?.id as string | undefined;
    let invited = false;

    if (!userId) {
      const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
      const redirectTo = projectId ? `https://project--${projectId}.lovable.app/auth` : undefined;
      const { data: invitedRes, error: e } = await (supabaseAdmin as any).auth.admin.inviteUserByEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (e) throw new Error(e.message);
      userId = invitedRes?.user?.id;
      if (!userId) throw new Error("Could not create invite.");
      invited = true;
    }

    // Grant advisor role (and remove any client_viewer role to avoid mixed state)
    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .upsert({ user_id: userId, role: "advisor" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "client_viewer");

    return { ok: true, invited };
  });

export const revokeAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You can't revoke your own advisor access.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Safety: make sure at least one other advisor remains
    const { data: others } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "advisor")
      .neq("user_id", data.userId);
    if (!others || others.length === 0) {
      throw new Error("At least one advisor must remain.");
    }

    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "advisor");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
