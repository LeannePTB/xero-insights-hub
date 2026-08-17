import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportAccessState = {
  firmId: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  grantedByName: string | null;
  note: string | null;
  /** True when the caller owns the organisation and may change the setting. */
  canManage: boolean;
  /** True when the caller may open this organisation's client data. */
  viewerHasClientData: boolean;
  /** True when the caller is a member of this organisation. */
  viewerIsMember: boolean;
  /** True when the caller is platform staff (super admin / advisor). */
  viewerIsPlatformStaff: boolean;
  /** True when the caller is a Traction Advisory super admin. */
  viewerIsSuperAdmin: boolean;
  /** True when the caller may manage the setting only because they are a super admin. */
  managesAsSuperAdmin: boolean;
};

export const getSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<SupportAccessState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");

    const [{ data: firm }, { data: row }, { data: roles }, { data: member }] = await Promise.all([
      (supabaseAdmin as any).from("firms").select("id, owner_user_id").eq("id", data.firmId).maybeSingle(),
      (supabaseAdmin as any)
        .from("firm_support_access")
        .select("granted, granted_at, revoked_at, granted_by, note")
        .eq("firm_id", data.firmId)
        .maybeSingle(),
      (supabaseAdmin as any).from("user_roles").select("role").eq("user_id", context.userId),
      (supabaseAdmin as any)
        .from("firm_members")
        .select("user_id")
        .eq("firm_id", data.firmId)
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (!firm) throw new Error("Organisation not found.");

    let grantedByName: string | null = null;
    if (row?.granted_by) {
      const { data: profile } = await (supabaseAdmin as any)
        .from("profiles")
        .select("display_name, email")
        .eq("id", row.granted_by)
        .maybeSingle();
      grantedByName = profile?.display_name ?? profile?.email ?? null;
    }

    const roleList = ((roles ?? []) as any[]).map((r) => r.role);
    const isSuperAdmin = roleList.includes("super_admin");
    const isPlatformStaff = isSuperAdmin || roleList.includes("advisor");
    const isOwner = firm.owner_user_id === context.userId;

    return {
      firmId: data.firmId,
      granted: !!row?.granted,
      grantedAt: (row?.granted_at as string | null) ?? null,
      revokedAt: (row?.revoked_at as string | null) ?? null,
      grantedByName,
      note: (row?.note as string | null) ?? null,
      canManage: isOwner || isSuperAdmin,
      viewerIsSuperAdmin: isSuperAdmin,
      managesAsSuperAdmin: isSuperAdmin && !isOwner,
      viewerIsMember: !!member,
      viewerIsPlatformStaff: isPlatformStaff,
      viewerHasClientData: member
        ? true
        : isPlatformStaff
          ? await platformStaffCanAccessFirm(context.userId, data.firmId)
          : false,
    };
  });

export const setSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; granted: boolean; note?: string }) => i)
  .handler(async ({ data, context }) => {
    // Written through the caller's own session so row-level security enforces
    // that only the organisation owner or a super admin can change it.
    const { error } = await (context.supabase as any)
      .from("firm_support_access")
      .upsert(
        {
          firm_id: data.firmId,
          granted: data.granted,
          granted_by: data.granted ? context.userId : null,
          granted_at: data.granted ? new Date().toISOString() : null,
          revoked_at: data.granted ? null : new Date().toISOString(),
          note: data.note ?? null,
        },
        { onConflict: "firm_id" },
      );
    if (error)
      throw new Error(
        "Only the organisation owner or a Traction Advisory super admin can change support access.",
      );
    return { ok: true, granted: data.granted };
  });
