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
    const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
    const hasAdvisorRole = roleNames.includes("advisor");
    const isSuperAdmin = roleNames.includes("super_admin");
    const isFirmOwner = roleNames.includes("firm_owner");

    const { data: memberships } = await context.supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    const firmIds = ((memberships ?? []) as any[]).map((m) => m.firm_id as string);
    const firmId: string | null = firmIds[0] ?? null;

    // A firm member is treated as an advisor for UX purposes (sees client list, can add clients).
    const isAdvisor = hasAdvisorRole || !!firmId;
    const hasAdminAreaAccess = isSuperAdmin || hasAdvisorRole || isFirmOwner || !!firmId;
    // Previewing the app as someone else is for platform admins and advisors only.
    const canViewAs = isSuperAdmin || hasAdvisorRole;

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
    return {
      isAdvisor,
      isSuperAdmin,
      isFirmOwner,
      hasAdminAreaAccess,
      canViewAs,
      firmId,
      firmIds,
      viewerClients,
    };

  });

