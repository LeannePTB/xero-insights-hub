import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

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
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<OrganisationMembersView> => {
    // Membership, and the emails shown, come from the database
    // (`public.organisation_members` re-checks aal2 + active membership and
    // reads the verified auth.users email, not a self-chosen profile field).
    const { data: rows, error } = await (context.supabase as any).rpc("organisation_members", {
      _firm_id: data.firmId,
    });
    if (error) {
      if (/not a member/i.test(error.message)) {
        return { members: [], currentOwnerUserId: null, isOwner: false, meUserId: context.userId };
      }
      throw new Error(error.message);
    }

    const members: OrganisationMember[] = ((rows ?? []) as any[]).map((r) => ({
      userId: r.user_id,
      email: r.email ?? null,
      displayName: r.display_name ?? null,
      role: r.role,
      status: r.status,
    }));
    members.sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));

    const { data: firm } = await context.supabase
      .from("firms")
      .select("owner_user_id")
      .eq("id", data.firmId)
      .maybeSingle();

    return {
      members,
      currentOwnerUserId: (firm as any)?.owner_user_id ?? null,
      isOwner: members.some((m) => m.userId === context.userId && m.role === "owner"),
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
  .middleware([requireAal2])
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
