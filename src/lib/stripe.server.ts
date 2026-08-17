// PHASE 2 SCAFFOLD — inert until the three Stripe secrets are added.
//
// This wires to the practice's OWN Stripe account. STRIPE_SANDBOX_API_KEY is a
// different account and must NEVER be used as a fallback here.
//
// Secrets (Project Settings → Secrets):
//   STRIPE_SECRET_KEY            server only
//   STRIPE_WEBHOOK_SECRET        server only
//   VITE_STRIPE_PUBLISHABLE_KEY  the only Stripe value allowed in the browser
//
// Never log a key, and never log a full Stripe request or response payload.

const API = "https://api.stripe.com/v1";

/** Reads a required server secret at request time. Fails closed. */
export function requireStripeSecret(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Billing is not configured yet: ${name} has not been added. Add it in Project Settings → Secrets.`,
    );
  }
  return value;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env["STRIPE_SECRET_KEY"]);
}

/** Minimal form-encoded Stripe call. Errors never include the key. */
export async function stripeRequest(
  path: string,
  init: { method: "GET" | "POST"; form?: Record<string, string> } = { method: "GET" },
): Promise<any> {
  const key = requireStripeSecret("STRIPE_SECRET_KEY");
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Message only — never the payload, never the key.
    throw new Error(`Stripe ${res.status}: ${json?.error?.message ?? "request failed"}`);
  }
  return json;
}

const enc = new TextEncoder();

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a Stripe webhook: HMAC-SHA256 signature, constant-time compare, and
 * a 5-minute timestamp tolerance. Signature checking alone does not stop
 * replay, so the timestamp check is mandatory.
 */
export async function verifyStripeWebhook(
  req: Request,
  toleranceSeconds = 300,
): Promise<{ event: any; body: string }> {
  const secret = requireStripeSecret("STRIPE_WEBHOOK_SECRET");
  const header = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!header || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") timestamp = v;
    if (k?.trim() === "v1" && v) v1.push(v);
  }
  if (!timestamp || v1.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) throw new Error("Webhook timestamp outside tolerance");

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${body}`));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!v1.some((sig) => timingSafeEqualHex(sig, expected))) throw new Error("Invalid webhook signature");

  return { event: JSON.parse(body), body };
}

/**
 * Trimmed copy of a Stripe object for billing_events.payload.
 * Only what reconciliation needs — never the full payload.
 */
export function trimStripeObject(type: string, obj: any) {
  return {
    type,
    id: obj?.id ?? null,
    customer: obj?.customer ?? null,
    subscription: obj?.subscription ?? null,
    status: obj?.status ?? null,
    current_period_end:
      obj?.items?.data?.[0]?.current_period_end ?? obj?.current_period_end ?? null,
    trial_end: obj?.trial_end ?? null,
    price: obj?.items?.data?.[0]?.price?.lookup_key ?? obj?.items?.data?.[0]?.price?.id ?? null,
    currency: obj?.currency ?? null,
    discount_coupon: obj?.discount?.coupon?.id ?? null,
    promotion_code: obj?.discount?.promotion_code ?? null,
  };
}
