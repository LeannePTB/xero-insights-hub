import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { DashboardTier } from "@/lib/tiers";
import type { ClientAccessRelationship } from "@/lib/access-labels";

export type OrganisationMembership = { firmId: string; role: "owner" | "staff" };

/**
 * UI context for the signed-in person. Every fact here comes from a
 * caller-scoped database function — this file never looks up roles,
 * memberships or client grants itself. Presentation and routing only:
 * every page and server function keeps its own server-side check.
 */
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: memberships }, { data: practice }] = await Promise.all([
      (context.supabase as any).rpc("my_roles"),
      (context.supabase as any).rpc("my_firm_memberships"),
      // Routing only (cross-organisation overview); never a grant.
      (context.supabase as any).rpc("me_is_practice_member"),
    ]);
    const roleNames = (roles ?? []) as string[];
    const isSuperAdmin = roleNames.includes("super_admin");
    // Platform staff = Traction Advisory roles only. Membership never sets it.
    const isPlatformStaff = isSuperAdmin || roleNames.includes("advisor");

    const orgMemberships: OrganisationMembership[] = ((memberships ?? []) as any[]).map((m) => ({
      firmId: m.firm_id as string,
      role: m.role === "owner" ? "owner" : "staff",
    }));
    const isOrganisationMember = orgMemberships.length > 0;
    const canViewAs = isPlatformStaff;

    let viewerClients: {
      id: string;
      name: string;
      tier: DashboardTier;
      relationship: ClientAccessRelationship | null;
    }[] = [];
    if (!isOrganisationMember && !isPlatformStaff) {
      const { data: access } = await (context.supabase as any).rpc("my_client_access");
      viewerClients = ((access ?? []) as any[]).map((a) => ({
        id: a.client_id as string,
        name: a.client_name as string,
        tier: a.tier as DashboardTier,
        relationship: (a.relationship ?? null) as ClientAccessRelationship | null,
      }));
    }
    return {
      isSuperAdmin,
      isPlatformStaff,
      isPracticeMember: practice === true,
      memberships: orgMemberships,
      isOrganisationMember,
      isClientViewer: viewerClients.length > 0,
      canViewAs,
      viewerClients,
    };
  });

/**
 * Per-client screen signal: may the caller manage this client? Answered by
 * the database (same predicate the client write paths use). Draws buttons
 * only — every write keeps its own server check.
 */
export const getMyClientCapabilities = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(i?.clientId ?? "")) throw new Error("Invalid client");
    return { clientId: i.clientId };
  })
  .handler(async ({ data, context }) => {
    const { data: can } = await (context.supabase as any).rpc("me_can_manage_client", {
      _client_id: data.clientId,
    });
    return { canManageClient: can === true };
  });
