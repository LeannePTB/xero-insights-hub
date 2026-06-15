import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardTier } from "@/lib/tiers";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const hasAdvisorRole = !!roles?.some((r: { role: string }) => r.role === "advisor");
    const isSuperAdmin = !!roles?.some((r: { role: string }) => r.role === "super_admin");

    const { data: membership } = await context.supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const firmId: string | null = (membership as any)?.firm_id ?? null;

    // A firm member is treated as an advisor for UX purposes (sees client list, can add clients).
    const isAdvisor = hasAdvisorRole || !!firmId;

    let viewerClients: { id: string; name: string; tier: DashboardTier }[] = [];
    if (!isAdvisor) {
      const { data: access } = await context.supabase
        .from("client_access")
        .select("tier, clients(id, name)")
        .eq("user_id", context.userId);
      viewerClients = ((access ?? []) as any[])
        .filter((a) => a.clients)
        .map((a) => ({ id: a.clients.id, name: a.clients.name, tier: a.tier as DashboardTier }));
    }
    return { isAdvisor, isSuperAdmin, firmId, viewerClients };
  });

