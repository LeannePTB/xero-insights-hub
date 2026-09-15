import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * "View as" is a presentation filter, never an access change: the preview
 * renders through the caller's own session and RLS, so it can only ever show
 * what that person could already read. It is still recorded, because looking at
 * another party's dashboards is exactly the kind of act an audit trail exists
 * for.
 *
 * Every rule is in public.record_view_as: aal2, platform super admin, and an
 * access path the caller already holds to that organisation (membership or an
 * approved support grant). Invariant 3 holds — super_admin on its own is
 * refused here too. Nothing is decided in this file.
 */
export const recordViewAs = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; clientId?: string | null; mode: "owner" | "client" }) => {
    if (!i?.firmId) throw new Error("firmId is required");
    return {
      firmId: i.firmId,
      clientId: typeof i.clientId === "string" && i.clientId ? i.clientId : null,
      mode: i.mode === "client" ? ("client" as const) : ("owner" as const),
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("record_view_as", {
      _firm_id: data.firmId,
      _client_id: data.clientId,
      _mode: data.mode,
    });
    if (error) {
      throw new Error(
        /forbidden/i.test(error.message)
          ? "You don't have access to that organisation."
          : error.message,
      );
    }
    return { recorded: true };
  });
