import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardTier } from "@/lib/tiers";

// PHASE 2 SCAFFOLD — inert until the Stripe secrets are added.
// Every handler reads its secret at call time and fails closed with a clear
// message. STRIPE_SANDBOX_API_KEY is never used as a fallback.
//
// TODO (GST): the tax treatment of these prices is NOT decided here. Do not
// assume GST-inclusive or GST-exclusive. Enable Stripe Tax on the account, or
// attach explicit tax rates to each price, and make the UI state plainly
// whether the shown AUD amount includes GST. A guessed treatment creates real
// accounting problems, so leave this TODO until the intent is confirmed.

async function assertCanBill(supabase: any, userId: string, clientId: string) {
  // Entitlement changes must never widen who can see a client: this only
  // checks the caller already manages the client, via the existing rule.
  const { data, error } = await supabase.rpc("user_can_access_client", {
    _user_id: userId,
    _client_id: clientId,
  });
  if (error || !data) throw new Error("You don't have access to this client.");
}

/**
 * Starts a Stripe Checkout session for a client subscription.
 * The 3-month offer is a PRICE, not an access state: pass a promotion code
 * backed by a coupon with duration=repeating, duration_in_months=3. The client
 * stays `paid` throughout and Stripe steps the price up by itself.
 */
export const createClientCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tier: DashboardTier; promotionCode?: string | null }) => i)
  .handler(async ({ data, context }) => {
    await assertCanBill(context.supabase, context.userId, data.clientId);
    const { stripeRequest } = await import("@/lib/stripe.server");
    // Throws a clear "not configured yet" error until the secret exists.
    void stripeRequest;
    throw new Error(
      "Billing checkout is not switched on yet: the Stripe keys for the practice account have not been added.",
    );
  });

/** Opens the Stripe billing portal so a client can change or cancel. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; returnUrl: string }) => i)
  .handler(async ({ data, context }) => {
    await assertCanBill(context.supabase, context.userId, data.clientId);
    throw new Error(
      "The billing portal is not switched on yet: the Stripe keys for the practice account have not been added.",
    );
  });
