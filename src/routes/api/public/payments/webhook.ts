import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function mapStatus(stripeStatus: string): string | null {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return null;
  }
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertFromSubscription(sub: any) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) {
    console.warn("[stripe webhook] subscription missing clientId metadata", sub.id);
    return;
  }
  const supabase = getSupabase();
  // Never override a free_forever record
  const { data: existing } = await supabase
    .from("client_subscriptions")
    .select("subscription_type, status")
    .eq("client_id", clientId)
    .maybeSingle();
  if ((existing as any)?.subscription_type === "free_forever") return;

  const item = sub.items?.data?.[0];
  const price = item?.price;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const mappedStatus = mapStatus(sub.status) ?? (existing as any)?.status ?? "trialing";
  const planName =
    price?.nickname ?? price?.lookup_key ?? price?.metadata?.lovable_external_id ?? null;

  const wasPastDue = (existing as any)?.status === "past_due";
  const nowPastDue = mappedStatus === "past_due";

  await supabase.from("client_subscriptions").upsert(
    {
      client_id: clientId,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      subscription_type: sub.status === "trialing" ? "trial" : "paid",
      status: mappedStatus,
      plan_name: planName,
      current_period_end: isoFromUnix(periodEnd),
      trial_end: isoFromUnix(sub.trial_end),
      past_due_since: nowPastDue
        ? wasPastDue
          ? undefined
          : new Date().toISOString()
        : null,
    } as any,
    { onConflict: "client_id" },
  );
}

async function handleSubscriptionDeleted(sub: any) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) return;
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("client_subscriptions")
    .select("subscription_type")
    .eq("client_id", clientId)
    .maybeSingle();
  if ((existing as any)?.subscription_type === "free_forever") return;
  await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled" } as any)
    .eq("client_id", clientId);
}

async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from("client_subscriptions")
    .select("client_id, status, past_due_since, subscription_type")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!row || (row as any).subscription_type === "free_forever") return;
  await supabase
    .from("client_subscriptions")
    .update({
      status: "past_due",
      past_due_since: (row as any).past_due_since ?? new Date().toISOString(),
    } as any)
    .eq("client_id", (row as any).client_id);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object);
      break;
    default:
      console.log("[stripe webhook] unhandled:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[stripe webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
