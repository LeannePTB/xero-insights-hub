import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportGrantStatus = "pending" | "active" | "expired" | "revoked";

export type SupportGrant = {
  id: string;
  granteeUserId: string;
  granteeName: string | null;
  status: SupportGrantStatus;
  expiresAt: string;
  grantedAt: string | null;
  revokedAt: string | null;
  grantedByName: string | null;
  reason: string | null;
  note: string | null;
  /** True when this grant belongs to the caller. */
  isMine: boolean;
};

export type SupportAccessState = {
  firmId: string;
  /** True when at least one grant is currently active. */
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  grantedByName: string | null;
  note: string | null;
  /** Every grant row for the organisation, newest first. */
  grants: SupportGrant[];
  /** True when the caller owns the organisation and may approve / revoke. */
  canManage: boolean;
  /** True when the caller may request support access for themselves. */
  canRequest: boolean;
  /** The caller's own live or pending grant, if any. */
  myGrant: SupportGrant | null;
  /** True when the caller may open this organisation's client data. */
  viewerHasClientData: boolean;
  /** True when the caller is an active member of this organisation. */
  viewerIsMember: boolean;
  /** True when the caller is platform staff (super admin / advisor). */
  viewerIsPlatformStaff: boolean;
  /** True when the caller is a Traction Advisory super admin. */
  viewerIsSuperAdmin: boolean;
};

const GRANT_WINDOW_MS = 72 * 60 * 60 * 1000;

function statusOf(row: any): SupportGrantStatus {
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return row.granted ? "active" : "pending";
}

export const getSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<SupportAccessState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");

    const [{ data: firm }, { data: rows }, { data: roles }, { data: member }] = await Promise.all([
      (supabaseAdmin as any).from("firms").select("id, owner_user_id").eq("id", data.firmId).maybeSingle(),
      (supabaseAdmin as any)
        .from("firm_support_access")
        .select(
          "id, granted, granted_at, revoked_at, granted_by, note, reason, expires_at, grantee_user_id, created_at",
        )
        .eq("firm_id", data.firmId)
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any).from("user_roles").select("role").eq("user_id", context.userId),
      (supabaseAdmin as any)
        .from("firm_members")
        .select("user_id, status")
        .eq("firm_id", data.firmId)
        .eq("user_id", context.userId)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    if (!firm) throw new Error("Organisation not found.");

    const list = ((rows ?? []) as any[]) ?? [];
    const ids = Array.from(
      new Set(list.flatMap((r) => [r.grantee_user_id, r.granted_by]).filter(Boolean)),
    ) as string[];
    const nameById = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      for (const p of (profiles ?? []) as any[]) {
        nameById.set(p.id, p.display_name ?? p.email ?? "");
      }
    }

    const grants: SupportGrant[] = list.map((r) => ({
      id: r.id as string,
      granteeUserId: r.grantee_user_id as string,
      granteeName: nameById.get(r.grantee_user_id) || null,
      status: statusOf(r),
      expiresAt: r.expires_at as string,
      grantedAt: (r.granted_at as string | null) ?? null,
      revokedAt: (r.revoked_at as string | null) ?? null,
      grantedByName: r.granted_by ? nameById.get(r.granted_by) || null : null,
      reason: (r.reason as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      isMine: r.grantee_user_id === context.userId,
    }));

    const roleList = ((roles ?? []) as any[]).map((r) => r.role);
    const isSuperAdmin = roleList.includes("super_admin");
    const isPlatformStaff = isSuperAdmin || roleList.includes("advisor");
    const isOwner = firm.owner_user_id === context.userId;
    const activeGrant = grants.find((g) => g.status === "active") ?? null;
    const myGrant =
      grants.find((g) => g.isMine && (g.status === "active" || g.status === "pending")) ?? null;

    return {
      firmId: data.firmId,
      granted: !!activeGrant,
      grantedAt: activeGrant?.grantedAt ?? null,
      revokedAt: grants.find((g) => g.revokedAt)?.revokedAt ?? null,
      grantedByName: activeGrant?.grantedByName ?? null,
      note: activeGrant?.note ?? null,
      grants,
      // A super admin must never be able to approve their own access.
      canManage: isOwner,
      canRequest: isSuperAdmin && !isOwner && !member && !myGrant,
      myGrant,
      viewerIsSuperAdmin: isSuperAdmin,
      viewerIsMember: !!member,
      viewerIsPlatformStaff: isPlatformStaff,
      viewerHasClientData: await platformStaffCanAccessFirm(context.userId, data.firmId),
    };
  });

/**
 * A super admin asks an organisation for time-boxed, read-only support access.
 * This is a REQUEST only — it never grants anything. Written through the
 * caller's session so row-level security decides whether it's allowed.
 */
export const requestSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("firm_support_access").insert({
      firm_id: data.firmId,
      grantee_user_id: context.userId,
      requested_by: context.userId,
      granted: false,
      granted_by: null,
      granted_at: null,
      revoked_at: null,
      reason: data.reason ?? null,
      expires_at: new Date(Date.now() + GRANT_WINDOW_MS).toISOString(),
    });
    if (error)
      throw new Error(
        "Could not request support access. You may already have an open request for this organisation.",
      );
    return { ok: true };
  });

/**
 * Approve or revoke a support grant. Approving is owner-only; revoking may be
 * done by the owner or by the grantee revoking their own grant. Enforced by
 * row-level security through the caller's own session.
 */
export const decideSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { grantId: string; approve: boolean; note?: string }) => i)
  .handler(async ({ data, context }) => {
    const patch = data.approve
      ? {
          granted: true,
          granted_by: context.userId,
          granted_at: new Date().toISOString(),
          revoked_at: null,
          note: data.note ?? null,
        }
      : {
          granted: false,
          revoked_at: new Date().toISOString(),
          note: data.note ?? null,
        };

    const { data: row, error } = await (context.supabase as any)
      .from("firm_support_access")
      .update(patch)
      .eq("id", data.grantId)
      .select("id, granted")
      .maybeSingle();

    if (error || !row)
      throw new Error(
        data.approve
          ? "Only the organisation owner can approve support access."
          : "Only the organisation owner or the named staff member can revoke this access.",
      );
    return { ok: true, granted: !!row.granted };
  });
