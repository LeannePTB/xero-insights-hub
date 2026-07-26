import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

export const GRACE_PERIOD_DAYS = 7;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function loadClient(supabase: any, clientId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, firm_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found");
  return data;
}

async function loadSub(supabase: any, clientId: string) {
  const { data } = await supabase
    .from("client_subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

// Read for any firm/client-access user
export const getClientSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const sub = await loadSub(context.supabase, data.clientId);
    return { subscription: sub ?? null, gracePeriodDays: GRACE_PERIOD_DAYS };
  });

// Admin: list all client subs
export const listClientSubscriptionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, name, firm_id, firms(name)")
      .order("name", { ascending: true });
    const { data: subs } = await supabaseAdmin.from("client_subscriptions").select("*");
    const subMap = new Map((subs ?? []).map((s: any) => [s.client_id, s]));
    return {
      rows: (clients ?? []).map((c: any) => ({
        client_id: c.id,
        client_name: c.name,
        firm_name: c.firms?.name ?? null,
        subscription: subMap.get(c.id) ?? null,
      })),
    };
  });

export const markClientFreeForever = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("client_subscriptions").upsert(
      {
        client_id: data.clientId,
        subscription_type: "free_forever",
        status: "free_forever",
        plan_name: "Free Forever",
        stripe_subscription_id: null,
        current_period_end: null,
        trial_end: null,
        past_due_since: null,
      },
      { onConflict: "client_id" },
    );
    return { ok: true };
  });

export const unmarkClientFreeForever = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("client_subscriptions")
      .delete()
      .eq("client_id", data.clientId);
    return { ok: true };
  });

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  opts: { clientId: string; email?: string; name?: string; existingId?: string | null },
): Promise<string> {
  if (opts.existingId) return opts.existingId;
  if (!/^[a-zA-Z0-9-]+$/.test(opts.clientId)) throw new Error("Invalid clientId");
  const found = await stripe.customers.search({
    query: `metadata['clientId']:'${opts.clientId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;
  const created = await stripe.customers.create({
    ...(opts.email && { email: opts.email }),
    ...(opts.name && { name: opts.name }),
    metadata: { clientId: opts.clientId },
  });
  return created.id;
}

// Admin creates a Checkout session (hosted URL) for a paid subscription on a client
export const startClientCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      clientId: string;
      priceId: string;
      returnUrl: string;
      environment: StripeEnv;
      customerEmail?: string;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(i.priceId)) throw new Error("Invalid priceId");
      return i;
    },
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      await assertSuperAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const client = await loadClient(supabaseAdmin, data.clientId);
      const existing = await loadSub(supabaseAdmin, data.clientId);
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const price = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, {
        clientId: data.clientId,
        email: data.customerEmail,
        name: client.name,
        existingId: existing?.stripe_customer_id ?? null,
      });

      // Persist the customer id immediately so later reads/portal work
      await (supabaseAdmin as any).from("client_subscriptions").upsert(
        {
          client_id: data.clientId,
          stripe_customer_id: customerId,
          subscription_type: "paid",
          status: existing?.status ?? "trialing",
          plan_name: existing?.plan_name ?? null,
        },
        { onConflict: "client_id" },
      );

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { clientId: data.clientId },
        subscription_data: { metadata: { clientId: data.clientId } },
        managed_payments: { enabled: true },
      } as any);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; returnUrl?: string; environment: StripeEnv }) => i)
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Check caller has read on the client via the user's own client
      const { data: sub } = await context.supabase
        .from("client_subscriptions")
        .select("stripe_customer_id")
        .eq("client_id", data.clientId)
        .maybeSingle();
      if (!sub?.stripe_customer_id) throw new Error("No Stripe customer for this client");
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      // Touch supabaseAdmin to keep import (no-op)
      void supabaseAdmin;
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const cancelClientSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; environment: StripeEnv }) => i)
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      await assertSuperAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sub = await loadSub(supabaseAdmin, data.clientId);
      if (!sub?.stripe_subscription_id) throw new Error("No active Stripe subscription");
      const stripe = createStripeClient(data.environment);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
