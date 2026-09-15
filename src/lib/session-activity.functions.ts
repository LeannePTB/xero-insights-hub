import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Session activity and self-service device sign-out.
 *
 * The activity timestamp lives on the SERVER, in `public.session_activity`, and
 * is written only by `public.touch_session_activity()` — an aal2, caller-scoped
 * definer function that takes the session from the verified token and the time
 * from the server clock. Nothing here accepts a caller-supplied session, user
 * or timestamp, so the browser cannot extend its own life by asking nicely.
 *
 * Only REAL interaction reaches this: pointer, keyboard, navigation and
 * completed user-initiated requests. The presence heartbeat, snapshot refresh,
 * token refresh and every polling query deliberately do NOT call it, so an
 * unattended tab still times out.
 */
export const touchSessionActivity = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { error } = await (context.supabase as any).rpc("touch_session_activity", {});
    if (error) {
      // SESSION_IDLE is the normal answer for a session that already expired.
      // It is NOT an MFA problem, so it is reported as itself.
      if (/SESSION_IDLE/i.test(error.message)) throw new Error("SESSION_IDLE");
      // A SWALLOWED failure here is what caused the 15 Sep 2026 outage: nothing
      // was recorded and nobody knew until people were locked out. Log the
      // reason (never the token, session id or email) so a broken recorder is
      // visible in minutes.
      console.error(
        "[session-activity] could not record activity:",
        error.code ?? "",
        error.message ?? "",
      );
      throw new Error("Could not record activity.");
    }
    return { ok: true };
  });

/** Is the caller's own session still inside the activity window? */
export const sessionIsActive = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<{ active: boolean }> => {
    const { data, error } = await (context.supabase as any).rpc("session_is_active", {});
    // Unverifiable means not active: fail closed.
    if (error) return { active: false };
    return { active: data === true };
  });

/**
 * Audit trail for "sign out my other devices". The revocation itself is done in
 * the browser by `supabase.auth.signOut({ scope: 'others' })`, which deletes the
 * person's OTHER sessions in the authentication service — proven server-side
 * revocation, not browser clearing. This records who did it and when; no token
 * or device detail is ever written.
 */
export const recordSignOutOtherDevices = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { error } = await (context.supabase as any).rpc("record_sign_out_other_devices", {});
    if (error) throw new Error("Could not record that sign-out.");
    return { ok: true };
  });

/**
 * Super admin signs ANOTHER person out of every device (the stolen-device case,
 * where that person cannot use the self-service control).
 *
 * Mechanism, stated plainly because it has a real consequence: the
 * authentication service exposes NO admin "log this user out" endpoint on this
 * project (all three documented paths return 404 against a real user id), and a
 * temporary ban blocks a session only while it lasts — the same refresh token
 * works again once the ban lifts, so a ban is not a sign-out. The one mechanism
 * that genuinely deletes every session is an admin credential change: it was
 * measured taking that person's live sessions from 5 to 0. So this sets a random
 * password nobody knows (ending every session immediately) and emails them a
 * reset link, meaning they choose a new password on their next sign-in.
 *
 * Authorisation lives in the database: `admin_assert_can_sign_out_user` re-checks
 * aal2 and super admin, refuses the caller's own account (use the self control)
 * and refuses the last remaining super admin. The audit row is written only after
 * the revocation actually succeeded, and never carries a password or token.
 */
export const adminSignOutAllDevices = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }): Promise<{ ok: boolean; email: string }> => {
    const { error: authErr } = await (context.supabase as any).rpc(
      "admin_assert_can_sign_out_user",
      { _user_id: data.userId },
    );
    if (authErr) throw new Error(/forbidden/i.test(authErr.message) ? "Forbidden" : authErr.message);

    const { siteUrl } = await import("@/lib/site-origin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: u, error: gErr } = await (supabaseAdmin as any).auth.admin.getUserById(
      data.userId,
    );
    if (gErr || !u?.user?.email) throw new Error("User not found");
    const email = u.user.email as string;

    // A random password nobody holds: it is never returned, logged or stored.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const oneTime = `Ta${Array.from(bytes, (b) => b.toString(36)).join("")}9`;

    const { error: pErr } = await (supabaseAdmin as any).auth.admin.updateUserById(data.userId, {
      password: oneTime,
    });
    if (pErr) throw new Error("Could not end that person's sessions. Nothing has changed.");

    const { error: rErr } = await (supabaseAdmin as any).auth.resetPasswordForEmail(email, {
      redirectTo: siteUrl("/set-password"),
    });

    const { error: aErr } = await (context.supabase as any).rpc("record_sign_out_all_devices", {
      _user_id: data.userId,
      _method: "credential_reset",
    });
    if (aErr) throw new Error("Sessions were ended but the audit row failed — tell the owner.");

    if (rErr) {
      throw new Error(
        "Every device is signed out, but the reset email could not be sent — set a password for them instead.",
      );
    }
    return { ok: true, email };
  });
