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
