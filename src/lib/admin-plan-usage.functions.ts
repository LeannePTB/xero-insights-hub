import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { organisationUsage, type OrganisationUsage } from "@/lib/admin-plan-usage.server";

export type { OrganisationUsage };

/** Plan usage (limits + dashboard tiers in use) for the Organisations table. */
export const listOrganisationUsage = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    const usage = await organisationUsage(context.supabase, data.firmIds ?? []);
    return { usage };
  });
