# Stripe Subscription Billing (Client-Scoped)

## Approach

Use Lovable's built-in Stripe payments (`enable_stripe_payments`) so no keys are needed. Add a new **client-scoped** `client_subscriptions` table (the existing `subscriptions` table is firm-scoped and stays untouched, still driving firm tiering). Stripe Checkout starts paid subs, Customer Portal manages them, and a TanStack server route webhook keeps status in sync.

## Data Model

New table `public.client_subscriptions`:
- `client_id uuid unique` → `clients.id` (one sub per client)
- `stripe_customer_id text`
- `stripe_subscription_id text unique nullable`
- `plan_name text` (e.g. "Standard Monthly")
- `subscription_type` enum: `paid | free_forever | trial`
- `status` enum: `active | trialing | past_due | cancelled | free_forever`
- `current_period_end timestamptz nullable`
- `trial_end timestamptz nullable`
- `past_due_since timestamptz nullable` (for grace-period lockout)
- `created_at`, `updated_at`

RLS: firm members read their client's sub; only super-admin writes (webhook uses service role).

App setting `billing_grace_period_days` (default 7) stored in a small `app_settings` table or hardcoded initially.

## Status Mapping (Stripe → app)

| Stripe status | App status |
|---|---|
| trialing | trialing |
| active | active |
| past_due, unpaid | past_due |
| canceled, incomplete_expired | cancelled |
| incomplete | (unchanged, pending checkout) |

`free_forever` is set manually by admin; webhook never overrides it.

## Stripe Integration

1. Run `payments--enable_stripe_payments`, then create products/prices via `batch_create_product` (tax handling: managed_payments for digital SaaS).
2. Server functions in `src/lib/billing.functions.ts`:
   - `startCheckout({ clientId, priceId })` → creates Stripe customer if missing, returns Checkout Session URL (mode=subscription).
   - `openPortal({ clientId })` → returns Customer Portal URL.
   - `markFreeForever({ clientId })` / `unmarkFreeForever` (super-admin).
   - `cancelSubscription({ clientId })` (super-admin, cancel at period end).
3. Webhook at `src/routes/api/public/stripe/webhook.ts` — verifies signature, handles `customer.subscription.{created,updated,deleted}` and `invoice.payment_failed`; upserts into `client_subscriptions`.

## UI Changes

**Client list card** (`ClientHealthBadge` neighbourhood on dashboard/firm pages): new `SubscriptionBadge` — green Active, blue Trialing ("Trial ends in N days"), grey Free Forever, red Past Due / Cancelled. Small due-date line below.

**Admin → Billing** (new route `/admin/billing`, super-admin only, added to `AdminSidebar`): table of all clients with plan, status, due date, Stripe customer link; filter by status; row actions — "Start subscription" (Checkout link), "Open portal", "Mark Free Forever", "Cancel".

**Client settings** (`clients.$clientId.settings.tsx`): new "Subscription" panel — plan, status, due date, "Manage billing" button → Customer Portal.

## Access Gating

Add `useSubscriptionGate(clientId)` used at top of client dashboard route:
- `active | trialing | free_forever` → allow.
- `past_due` within grace window → allow + banner.
- `past_due` beyond grace / `cancelled` → block dashboard, show reactivate prompt with "Contact your advisor" or portal link.
- Trialing → yellow banner "Trial ends in N days".

Super-admins bypass the gate.

## Technical Details

- New TanStack public route `api/public/stripe/webhook` — reads raw body, `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`, uses `supabaseAdmin` for writes.
- Secrets: `STRIPE_SECRET_KEY` (auto via enable), `STRIPE_WEBHOOK_SECRET` (user pastes after configuring in Stripe dashboard — added via `add_secret`).
- Migration includes GRANTs and RLS policies per Lovable conventions.
- Free-forever flag `firms.is_always_free` already exists at firm level; leave it alone. New table is per-client and independent.
- Types regen after migration; billing.functions.ts written after.

## Out of Scope (this pass)

- Per-tier gating of dashboard widgets by plan (existing tier system stays).
- Proration/plan-change UX beyond what Stripe Portal provides.
- Multi-currency (defer until you sell outside AUD).

Confirm and I'll start with the migration, then Stripe enable, then products, then code.
