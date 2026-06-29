import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Per-tenant Xero integration log. Surfaces audit_log rows scoped to a single
 * Xero org so the user can self-diagnose failures (Xero certification
 * checkpoint 6 — error visibility). Access is gated by the same connection
 * lookup the dashboard uses, so callers only see events for orgs they can
 * already read data from.
 */
export const listXeroLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; limit?: number }) => input)
  .handler(async ({ data }) => {
    // Authorize: throws if the calling user can't reach this tenant.
    const { getConnectionByTenant } = await import("@/lib/xero/api.server");
    await getConnectionByTenant(data.tenantId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("audit_log")
      .select("id, action, target_id, meta, at, actor_user_id")
      .eq("target_type", "xero_connection")
      .eq("target_id", data.tenantId)
      .order("at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 200));
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
