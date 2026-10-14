import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Server-side gate for the Company Consolidations page.
 *
 * The organisation id in the request is a FILTER, never a grant: everything
 * here runs through the caller's own session, so RLS decides what they can
 * see, and the add-on entitlement is answered by the database
 * (`firm_can_use_widget`) rather than reimplemented here. Fails closed.
 */
export const getConsolidationsAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ allowed: boolean; firmName: string | null; message?: string }> => {
      // RLS: a caller with no access to this organisation gets no row.
      const { data: firm } = await context.supabase
        .from("firms")
        .select("id, name")
        .eq("id", data.firmId)
        .maybeSingle();

      if (!firm) {
        return {
          allowed: false,
          firmName: null,
          message: "You don't have access to that organisation.",
        };
      }

      // Owner or active Traction Advisory team member, Consolidation purchased.
      const { data: canOpen } = await (context.supabase as any).rpc("me_can_open_consolidations", { _firm_id: data.firmId });
      const allowed = canOpen === true;

      return {
        allowed,
        firmName: firm.name as string,
        ...(allowed
          ? {}
          : {
              message:
                "Consolidations open only for the Organisation Owner and the Traction Advisory team, when the organisation has the Consolidation package.",
            }),
      };
    },
  );
