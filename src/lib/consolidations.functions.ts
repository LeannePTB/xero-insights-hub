import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side gate for the Company Consolidations page.
 *
 * The organisation id in the request is a FILTER, never a grant: everything
 * here runs through the caller's own session, so RLS decides what they can
 * see, and the add-on entitlement is answered by the database
 * (`firm_can_use_widget`) rather than reimplemented here. Fails closed.
 */
export const getConsolidationsAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

      const { firmCanUseWidget } = await import("@/lib/widget-access.server");
      const allowed = await firmCanUseWidget(context.supabase, data.firmId, "loan_consolidation");

      return {
        allowed,
        firmName: firm.name as string,
        ...(allowed
          ? {}
          : {
              message:
                "Consolidation tools aren't included in this organisation's plan. Upgrade the plan to turn them on.",
            }),
      };
    },
  );
