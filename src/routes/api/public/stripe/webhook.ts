import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// PHASE 2 SCAFFOLD — inert until STRIPE_WEBHOOK_SECRET is added.
//
// Stripe is the source of truth for billing state; the database mirrors it.
// Rules enforced here:
//  - signature verified with a 5-minute timestamp tolerance and constant-time
//    comparison (verification alone does not stop replay)
//  - idempotent via billing_events.stripe_event_id (unique)
//  - client_id is NEVER read from the body: it is resolved from the Stripe
//    customer / subscription id already stored on client_subscriptions
//  - cancellation downgrades to free Standard and KEEPS the row (billing
//    history), it never deletes it
//  - only a trimmed payload is stored, never a full Stripe payload or a key

let _sb: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_sb) {
    _sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _sb;
}

async function resolveClientId(obj: any): Promise<string | null> {
  const sb: any = admin();
  const subId = typeof obj?.id === "string" && obj.id.startsWith("sub_") ? obj.id : obj?.subscription;
  if (subId) {
    const { data } = await sb
      .from("client_subscriptions")
      .select("client_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (data?.client_id) return data.client_id as string;
  }
  if (obj?.customer) {
    const { data } = await sb
      .from("client_subscriptions")
      .select("client_id")
      .eq("stripe_customer_id", obj.customer)
      .maybeSingle();
    if (data?.client_id) return data.client_id as string;
  }
  // First subscription for a client: Stripe carries the link in metadata we set
  // at checkout. It is only trusted to CREATE the mapping, never to move one.
  const metaClient = obj?.metadata?.clientId;
  return typeof metaClient === "string" ? metaClient : null;
}

function isoFromUnix(v: unknown): string | null {
  return typeof v === "number" ? new Date(v * 1000).toISOString() : null;
}

async function applySubscription(obj: any, clientId: string, cancelled: boolean) {
  const sb: any = admin();
  const item = obj?.items?.data?.[0];
  const periodEnd = isoFromUnix(item?.current_period_end ?? obj?.current_period_end);

  const row: Record<string, unknown> = {
    client_id: clientId,
    stripe_subscription_id: obj?.id ?? null,
    stripe_customer_id: obj?.customer ?? null,
    current_period_end: periodEnd,
    trial_end: isoFromUnix(obj?.trial_end),
    coupon_id: obj?.discount?.coupon?.id ?? null,
    promotion_code: obj?.discount?.promotion_code ?? null,
    updated_at: new Date().toISOString(),
  };

  if (cancelled) {
    // Downgrade, never delete — the row is the billing history.
    row["status"] = "cancelled";
    row["subscription_type"] = "paid";
    row["dashboard_tier"] = "basic";
  } else {
    const status = String(obj?.status ?? "active");
    row["status"] = ["active", "trialing", "past_due", "cancelled"].includes(status) ? status : "active";
    row["subscription_type"] = status === "trialing" ? "trial" : "paid";
    if (status === "past_due") row["past_due_since"] = new Date().toISOString();
    else row["past_due_since"] = null;
  }

  await sb.from("client_subscriptions").upsert(row, { onConflict: "client_id" });
}

async function handleEvent(event: any) {
  const sb: any = admin();
  const obj = event?.data?.object ?? {};
  const clientId = await resolveClientId(obj);

  const { trimStripeObject } = await import("@/lib/stripe.server");
  // Unique on stripe_event_id: a duplicate delivery stops right here.
  const { error: dupe } = await sb.from("billing_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    client_id: clientId,
    payload: trimStripeObject(event.type, obj),
    occurred_at: isoFromUnix(event.created) ?? new Date().toISOString(),
  });
  if (dupe) return; // already processed

  if (!clientId) return;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await applySubscription(obj, clientId, false);
      break;
    case "customer.subscription.deleted":
      await applySubscription(obj, clientId, true);
      break;
    case "invoice.payment_failed":
      await sb
        .from("client_subscriptions")
        .update({ status: "past_due", past_due_since: new Date().toISOString() })
        .eq("client_id", clientId);
      break;
    case "invoice.paid":
      await sb
        .from("client_subscriptions")
        .update({ status: "active", past_due_since: null })
        .eq("client_id", clientId);
      break;
    default:
      break;
  }
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { verifyStripeWebhook } = await import("@/lib/stripe.server");
          const { event } = await verifyStripeWebhook(request);
          await handleEvent(event);
          return Response.json({ received: true });
        } catch (e) {
          // Message only — never the payload.
          console.error("[stripe-webhook]", (e as Error).message);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
