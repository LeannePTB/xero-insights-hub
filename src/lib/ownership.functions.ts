import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrganisationMember = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "staff";
  status: string;
};

export type OrganisationMembersView = {
  members: OrganisationMember[];
  currentOwnerUserId: string | null;
  isOwner: boolean;
  meUserId: string;
};

/** Active members of one organisation. Visible to its own members only. */
export const listOrganisationMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<OrganisationMembersView> => {
    const { data: mine, error } = await context.supabase
      .from("firm_members")
      .select("role, status")
      .eq("firm_id", data.firmId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mine || mine.status !== "active") {
      return { members: [], currentOwnerUserId: null, isOwner: false, meUserId: context.userId };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const [{ data: rows }, { data: firm }] = await Promise.all([
      admin
        .from("firm_members")
        .select("user_id, role, status")
        .eq("firm_id", data.firmId)
        .eq("status", "active"),
      admin.from("firms").select("owner_user_id").eq("id", data.firmId).maybeSingle(),
    ]);

    const ids = ((rows ?? []) as any[]).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id, email, display_name").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map<string, any>();
    for (const p of (profiles ?? []) as any[]) byId.set(p.id, p);

    const members: OrganisationMember[] = ((rows ?? []) as any[]).map((r) => ({
      userId: r.user_id,
      email: byId.get(r.user_id)?.email ?? null,
      displayName: byId.get(r.user_id)?.display_name ?? null,
      role: r.role,
      status: r.status,
    }));
    members.sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));

    return {
      members,
      currentOwnerUserId: (firm as any)?.owner_user_id ?? null,
      isOwner: mine.role === "owner",
      meUserId: context.userId,
    };
  });

function explainTransferError(message: string): string {
  if (/NOT_ORG_OWNER/i.test(message)) {
    return "Only the current organisation owner can hand ownership over.";
  }
  if (/NOT_A_MEMBER/i.test(message)) {
    return "That person isn't an active member of this organisation yet. Invite them and have them accept the invitation first, then transfer ownership.";
  }
  if (/NOT_AUTHENTICATED/i.test(message)) {
    return "Your session has expired. Please sign in again.";
  }
  return message || "Could not transfer ownership.";
}

/**
 * Hand organisation ownership to another active member.
 * All of the rules (owner-only, member-must-exist, demotion, audit) live in the
 * database function — this is a thin call through to it.
 */
export const transferOrganisationOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; newOwnerUserId: string; keepPreviousAsStaff?: boolean }) => i)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await (context.supabase as any).rpc("transfer_organisation_ownership", {
      _firm_id: data.firmId,
      _new_owner_user_id: data.newOwnerUserId,
      _keep_previous_as_staff: data.keepPreviousAsStaff !== false,
    });
    if (error) throw new Error(explainTransferError(error.message ?? ""));
    return { ok: true };
  });
