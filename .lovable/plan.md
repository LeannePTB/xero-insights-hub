# Client subscriptions, comped accounts and trials

Wire client-level billing to your existing Stripe account (no Lovable Stripe integration), and make dashboard entitlement a single, read-time decision in the database.

## Secrets you need to add (Project Settings → Secrets)

- `STRIPE_SECRET_KEY` — server only (test key first)
- `STRIPE_WEBHOOK_SECRET` — server only
- `VITE_STRIPE_PUBLISHABLE_KEY` — the only Stripe value allowed in the browser

Only `STRIPE_SANDBOX_API_KEY` currently exists in the environment; it will not be used. If a secret is missing, every server path fails closed with a plain message — no fallback keys, ever.

## Migration I intend to run (single migration, reviewed before it executes)

1. `ALTER TABLE public.client_subscriptions` — add:
   - `dashboard_tier public.dashboard_tier NOT NULL DEFAULT 'basic'` (the tier the subscription grants)
   - `promotion_code text`, `coupon_id text` (so the 3-month offer can be reported on)
   - `comp_reason text`, `comped_by uuid REFERENCES auth.users(id)`, `comped_at timestamptz`
   - unique indexes on `stripe_subscription_id` and `stripe_customer_id` (partial, where not null) so webhooks can resolve a client without trusting the request body
2. `ALTER TABLE public.billing_events ADD CONSTRAINT billing_events_stripe_event_id_key UNIQUE (stripe_event_id)` (if absent) for webhook idempotency; add nullable `client_id uuid REFERENCES public.clients(id)`.
3. New function — the single entitlement rule:

```sql
create or replace function public.client_entitlement(_client_id uuid)
returns table (
  tier public.dashboard_tier,      -- effective tier, 'basic' when nothing applies
  source text,                     -- paid | trial | free_forever | org_always_free | none
  expires_at timestamptz,          -- trial_end or current_period_end, null when open-ended
  in_grace boolean                 -- past_due but still inside current_period_end
)
language sql stable security definer set search_path = public, app_private
```
   Evaluated at read time, exactly like `firm_support_access_active`: a trial past `trial_end`, or a `past_due` subscription past `current_period_end`, stops granting the higher tier on the next request. Respects `tier_settings.enabled` as a global kill switch and `firms.is_always_free` at organisation level. Anything unknown resolves to `basic`. Granted to `authenticated`; revoked from `anon`.
4. New RLS policies on `client_subscriptions` only (no existing policy, function or `app_private.*` helper is touched):
   - read: `app_private.user_can_read_client(auth.uid(), client_id)`
   - write: super admin only (comps), plus service role for webhooks

Nothing is added to `client_subscription_type`, no new subscription tables.

## Requirement mapping

**Entitlement (R1).** `src/lib/entitlement.server.ts` calls the RPC; `getClientWidgets` and the upgrade prompts take the tier from it instead of `client_access.tier`. Organisation plan (`allowedTiersForClient`) stays as the ceiling — a client can never exceed what the organisation's plan includes. No `if (tier === 'advisory')` checks anywhere in components.

**Comps (R2).** Super-admin-only action on the client settings page: place a client on free Standard with a required reason. Enforced by RLS as well as UI. Every grant, change and removal writes an `audit_log` row with actor, client, previous state, new state and reason.

**Trials (R3).** `subscription_type = 'trial'` with `trial_end`. On expiry the client silently drops to free Standard — higher-tier cards simply stop rendering and the existing upgrade prompt appears in their place. No error page, no lockout.

**3-month offer (R4).** A Stripe coupon (`duration: repeating`, `duration_in_months: 3`) applied at checkout in AUD. The client stays `paid` throughout with full entitlements; Stripe steps the price up itself. The promotion code and coupon are recorded on `client_subscriptions` for reporting. No custom expiry logic.

**Webhooks (R5).** `src/routes/api/public/stripe/webhook.ts` — signature verified with `STRIPE_WEBHOOK_SECRET` (HMAC, no SDK), unverified requests rejected. Idempotent via `billing_events.stripe_event_id`. Handles `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`. Uses the service role, resolves `client_id` only from the stored Stripe customer/subscription ID, and stores a trimmed payload (ids, status, period dates, price, discount) — never a full payload, never a key.

## Checkout

`src/lib/stripe.server.ts` (secret key read inside handlers) plus `src/lib/billing.functions.ts`:
- `createClientCheckout({ clientId, tier, promotionCode? })` — organisation owner or super admin only, prices in AUD, `metadata.clientId` on the subscription
- `openBillingPortal({ clientId })` for changing or cancelling
- `getClientEntitlement({ clientId })` for the UI

## UI

- Client settings gains a "Subscription" section: current plan, source (Paid / Trial / Comped / Included), renewal or expiry date, upgrade / manage buttons.
- Super admin sees the comp controls behind the existing Super Admin View marker.
- Copy uses "organisation", "Standard" for the `basic` tier, Australian English, AUD.

## Invariants

Section 0 items touched: (3) super admin still gets no data access from this — entitlement never widens who can see a client; (4) client and org ids from callers stay filters, never grants; (6) the service role key stays server-side, as does `STRIPE_SECRET_KEY`; (9) the access rule stays in the database, and entitlement gets its own single database function rather than TypeScript branching.
