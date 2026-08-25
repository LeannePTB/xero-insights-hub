import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readSubscriptionStates, staffFirmIdsFor } from "@/lib/subscription-state.server";
import type { SubscriptionState } from "@/lib/subscription-state";

export type { SubscriptionState };

/** Expiry state for a set of organisations the caller is authorised to see. */
export const listSubscriptionStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    const states = await readSubscriptionStates(
      context.supabase,
      context.userId,
      data.firmIds ?? [],
    );
    return { states };
  });

/** Expiry state for one organisation. */
export const getSubscriptionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }) => {
    const states = await readSubscriptionStates(context.supabase, context.userId, [data.firmId]);
    return { state: states[0] ?? null };
  });

/**
 * Expiry state behind a client dashboard, for organisation staff only.
 * An invited client viewer gets null — they never see subscription notices.
 */
export const getClientSubscriptionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: client } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const firmId = (client as { firm_id: string | null } | null)?.firm_id ?? null;
    if (!firmId) return { state: null };

    const staffFirms = await staffFirmIdsFor(context.supabase, context.userId, [firmId]);
    if (!staffFirms.has(firmId)) return { state: null };

    const states = await readSubscriptionStates(context.supabase, context.userId, [firmId]);
    return { state: states[0] ?? null };
  });

/** Organisations the caller works in that are ending soon or already lapsed. */
export const listExpiringOrganisations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listExpiringForStaff } = await import("@/lib/subscription-state.server");
    return await listExpiringForStaff(context.supabase, context.userId);
  });
