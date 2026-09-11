import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

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

/**
 * Support-access state for one organisation.
 *
 * Both reads are caller-scoped database functions:
 *   public.firm_support_grants(firm)        — the grant rows, visible to the
 *       organisation's owner, its active members, the named person, or a
 *       super admin (request metadata only, never client data).
 *   public.firm_support_viewer_state(firm)  — the caller's own relationship to
 *       the organisation, including public.user_can_access_firm.
 * Names are display names; the verified sign-in email comes from auth.users
 * inside the database function, never from the profiles table.
 */
export const getSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<SupportAccessState> => {
    const [{ data: rows, error: rowsError }, { data: viewerRows, error: viewerError }] =
      await Promise.all([
        (context.supabase as any).rpc("firm_support_grants", { _firm_id: data.firmId }),
        (context.supabase as any).rpc("firm_support_viewer_state", { _firm_id: data.firmId }),
      ]);
    if (rowsError) throw new Error(rowsError.message);
    if (viewerError) throw new Error(viewerError.message);
    const viewer: any = (Array.isArray(viewerRows) ? viewerRows[0] : viewerRows) ?? {};

    const list = (rows ?? []) as any[];
    const grants: SupportGrant[] = list.map((r) => ({
      id: r.id as string,
      granteeUserId: r.grantee_user_id as string,
      granteeName: (r.grantee_name as string | null) || (r.grantee_email as string | null) || null,
      status: statusOf(r),
      expiresAt: r.expires_at as string,
      grantedAt: (r.granted_at as string | null) ?? null,
      revokedAt: (r.revoked_at as string | null) ?? null,
      grantedByName: r.granted_by
        ? (r.granted_by_name as string | null) || (r.granted_by_email as string | null) || null
        : null,
      reason: (r.reason as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      isMine: r.grantee_user_id === context.userId,
    }));

    const isSuperAdmin = !!viewer.is_super_admin;
    const isOwner = !!viewer.is_owner;
    const isMember = !!viewer.is_member;
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
      canRequest: isSuperAdmin && !isOwner && !isMember && !myGrant,
      myGrant,
      viewerIsSuperAdmin: isSuperAdmin,
      viewerIsMember: isMember,
      viewerIsPlatformStaff: !!viewer.is_platform_staff,
      viewerHasClientData: !!viewer.has_client_data,
    };
  });

/**
 * A super admin asks an organisation for time-boxed, read-only support access.
 * This is a REQUEST only — it never grants anything. Written through the
 * caller's session so row-level security decides whether it's allowed.
 */
export const requestSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
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
  .middleware([requireAal2])
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
