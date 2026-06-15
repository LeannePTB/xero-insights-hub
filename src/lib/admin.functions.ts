import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listFirmsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_firm_overview")
      .select("*")
      .order("firm_created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { firms: data ?? [] };
  });

export const getFirmAuditAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: events, error } = await context.supabase
      .from("audit_log")
      .select("id, action, target_type, target_id, actor_user_id, meta, at")
      .or(`target_id.eq.${data.firmId},meta->>firm_id.eq.${data.firmId}`)
      .order("at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });
