import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";


/**
 * The Traction Advisory practice team (people-and-access Batch 5).
 *
 * Membership of `practice_team` is metadata about our own staff (Path C): it
 * confers NO access on its own. It only means two things elsewhere, both of
 * which additionally require an ACTIVE `firm_members` row for the organisation
 * in question:
 *   - these people are added as members when we create a client organisation;
 *   - `app_private.is_practice_member_of` lets them manage that organisation's
 *     client viewers alongside its owner.
 *
 * Every function here defers to the database for authorisation: the
 * `admin_practice_team` / `admin_add_practice_member` /
 * `admin_remove_practice_member` definer functions assert aal2 and super admin
 * first and write the audit row themselves. The service role is used for one
 * thing only — resolving a verified auth email to a user id, which a browser
 * session cannot do.
 */
export const listPracticeTeam = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("admin_practice_team");
    if (error) throw new Error(error.message);
    return {
      members: ((data ?? []) as any[]).map((r) => ({
        userId: r.user_id as string,
        email: (r.email as string | null) ?? null,
        displayName: (r.display_name as string | null) ?? null,
        createdAt: r.created_at as string,
      })),
    };
  });

/**
 * Add or remove one person, by user id, from the advisors page. Both branches go
 * to the audited definer function on the CALLER's session (aal2 + super admin
 * asserted in the database); the service role is never involved.
 */
export const setPracticeMembership = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { userId: string; onTeam: boolean }) => {
    const userId = String(i?.userId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
      throw new Error("Choose a person.");
    return { userId, onTeam: !!i.onTeam };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc(
      data.onTeam ? "admin_add_practice_member" : "admin_remove_practice_member",
      { _user_id: data.userId },
    );
    if (error) throw new Error(error.message);
    return { ok: true, onTeam: data.onTeam };
  });

export const removePracticeMember = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_remove_practice_member", {
      _user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
