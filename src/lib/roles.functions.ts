import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { DashboardTier } from "@/lib/tiers";

/**
 * UI context for the signed-in person. Every fact here comes from a
 * caller-scoped database function — this file never looks up roles,
 * memberships or client grants itself.
 */
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: memberships }] = await Promise.all([
      (context.supabase as any).rpc("my_roles"),
      (context.supabase as any).rpc("my_firm_memberships"),
    ]);
    const roleNames = ((roles ?? []) as string[]) ?? [];
    const hasAdvisorRole = roleNames.includes("advisor");
    const isSuperAdmin = roleNames.includes("super_admin");
    const isFirmOwner = roleNames.includes("firm_owner");

    const firmIds = ((memberships ?? []) as any[]).map((m) => m.firm_id as string);
    const firmId: string | null = firmIds[0] ?? null;

    // A firm member is treated as an advisor for UX purposes (sees client list, can add clients).
    const isAdvisor = hasAdvisorRole || !!firmId;
    const hasAdminAreaAccess = isSuperAdmin || hasAdvisorRole || isFirmOwner || !!firmId;
    // Previewing the app as someone else is for platform admins and advisors only.
    const canViewAs = isSuperAdmin || hasAdvisorRole;

    let viewerClients: { id: string; name: string; tier: DashboardTier }[] = [];
    if (!isAdvisor) {
      const { data: access } = await (context.supabase as any).rpc("my_client_access");
      viewerClients = ((access ?? []) as any[]).map((a) => ({
        id: a.client_id as string,
        name: a.client_name as string,
        tier: a.tier as DashboardTier,
      }));
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

