import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tier keys the client's organisation plan includes. `null` = unrestricted. */
export const getAllowedTiersForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data }): Promise<{ allowed: string[] | null }> => {
    const { allowedTiersForClient } = await import("@/lib/plan-tiers.server");
    return { allowed: await allowedTiersForClient(data.clientId) };
  });

/** Tier keys an organisation's plan includes. `null` = unrestricted. */
export const getAllowedTiersForFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data }): Promise<{ allowed: string[] | null }> => {
    const { allowedTiersForFirm } = await import("@/lib/plan-tiers.server");
    return { allowed: await allowedTiersForFirm(data.firmId) };
  });
