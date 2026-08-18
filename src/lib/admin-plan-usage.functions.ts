import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { organisationUsage, type OrganisationUsage } from "@/lib/admin-plan-usage.server";

export type { OrganisationUsage };

/** Plan usage (limits + dashboard tiers in use) for the Organisations table. */
export const listOrganisationUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    const usage = await organisationUsage(context.supabase, data.firmIds ?? []);
    return { usage };
  });
