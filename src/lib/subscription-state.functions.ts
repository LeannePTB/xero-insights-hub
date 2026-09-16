import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { readSubscriptionStates, staffFirmIdsFor } from "@/lib/subscription-state.server";
import type { SubscriptionState } from "@/lib/subscription-state";

export type { SubscriptionState };

/** Expiry state for a set of organisations the caller is authorised to see. */
export const listSubscriptionStates = createServerFn({ method: "POST" })
  .middleware([requireAal2])
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
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }) => {
    const states = await readSubscriptionStates(context.supabase, context.userId, [data.firmId]);
    return { state: states[0] ?? null };
  });

/**
 * Trial state of the organisation behind a client dashboard, for the people
 * allowed to see billing: active members of that organisation and the client's
 * business owner. An external adviser, standing viewer or support grant gets
 * null — public.client_org_trial returns them no rows by design.
 */
export const getClientOrgTrial = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("client_org_trial", {
      _client_id: data.clientId,
    });
    if (error) return { trial: null };
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | {
          trial_active: boolean;
          trial_ends_at: string | null;
          days_remaining: number | null;
          ending_soon: boolean;
        }
      | undefined;
    if (!row?.trial_active || !row.trial_ends_at) return { trial: null };
    return {
      trial: {
        endsAt: row.trial_ends_at,
        daysRemaining: row.days_remaining,
        endingSoon: !!row.ending_soon,
      },
    };
  });

/** Expiry state behind a client dashboard, for organisation staff only.
 * An invited client viewer gets null — they never see subscription notices.
 */
export const getClientSubscriptionState = createServerFn({ method: "POST" })
  .middleware([requireAal2])
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
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const { listExpiringForStaff } = await import("@/lib/subscription-state.server");
    return await listExpiringForStaff(context.supabase, context.userId);
  });
