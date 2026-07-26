## Reframe: firm-level subscriptions with client quotas

Today's `client_subscriptions` table is per-client (Stripe row per client), which doesn't match the real SaaS model. Advisors buy **one plan for the firm** that entitles them to N clients. The main dashboard (Organisations) should show each firm's plan and how many client slots they've used.

## Data model

New table `firm_subscriptions` (one row per firm):

- `firm_id uuid PRIMARY KEY REFERENCES firms(id)`
- `plan_key text` — `starter_5 | growth_10 | scale_20 | firm_50 | free_forever`
- `client_limit int` — 5 / 10 / 20 / 50, or a big number for free_forever
- `status text` — `active | trialing | past_due | cancelled | free_forever`
- `stripe_customer_id text nullable`
- `stripe_subscription_id text nullable`
- `current_period_end timestamptz nullable`
- `trial_end timestamptz nullable`
- `past_due_since timestamptz nullable`
- `created_at`, `updated_at`

GRANT + RLS: super-admin full; firm members read their own firm's row.

Keep `client_subscriptions` in place (unused for now, no removal) so we don't churn the schema again.

Keep the firms-level `is_always_free` boolean but stop using it — `free_forever` on `firm_subscriptions` is the single source of truth going forward. Migration copies existing `is_always_free = true` firms into a `free_forever` row.

## Stripe products

Create four subscription products (monthly, AUD, prices as placeholders you can edit later):

- `traction_starter` → `starter_monthly` (5 clients)
- `traction_growth` → `growth_monthly` (10 clients)
- `traction_scale` → `scale_monthly` (20 clients)
- `traction_firm` → `firm_monthly` (50 clients)

Each price carries `metadata.client_limit` so the webhook can derive the quota.

Retire the existing per-client `traction_standard` / `traction_advisory` products from active use (leave them in Stripe; just don't sell them). The old `client_subscriptions` webhook path stays wired but unused.

## Server side

- `src/lib/billing.functions.ts`:
  - `getFirmSubscription({ firmId })` — read one row.
  - `startFirmCheckout({ firmId, priceKey })` (super-admin) — creates/reuses a Stripe Customer keyed to the firm and returns an embedded-checkout `clientSecret`.
  - `openFirmPortal({ firmId })` — Stripe Billing Portal for that firm.
  - `setFirmFreeForever({ firmId, on })` (super-admin) — upserts a `free_forever` row with `client_limit = 9999`.
  - `assertCanAddClient(firmId)` — throws when active clients ≥ `client_limit`; called from `createClient` server fn.
- Webhook `/api/public/payments/webhook`: extend to handle firm subscriptions. Match by `metadata.firmId` on the Stripe Customer, write `plan_key`, `client_limit`, `status`, dates.

## UI

- **Main dashboard (`dashboard.tsx` Firm grid)**: each firm card/row shows plan name, status badge (Active / Trial X days / Free / Overdue / No plan), and `used/limit` clients (e.g. "2 / 10 clients"). Colour-code the badge like the existing `SubscriptionStatusBadge`.
- **Firm detail (`firms.$firmId.tsx`)**: header shows the same plan + slot usage. "New client" button disables and tooltips "Upgrade your plan to add more clients" when at the limit.
- **Admin → Organisations detail (`/admin/firms/$firmId`)**: replace the current `is_always_free` toggle with a Subscription panel — plan dropdown, "Mark free forever" switch, "Start checkout" button (opens embedded Stripe checkout), "Open Stripe portal" button, current status/renewal.
- Rip out the hidden client-level billing UI (`SubscriptionBadge` on the client table, `SubscriptionPanel` in client settings, `SubscriptionGate` around client dashboard, `/admin/billing` route). The old `client_subscriptions` code and table remain in place as-is; only the imports/routes are removed. Replace the "Tiers" column on the firm client table with the still-useful **slot usage** context in the firm header instead.

## Enforcement

`createClient` server fn calls `assertCanAddClient` — over-limit returns a toast and blocks. Cancelled/past_due (past grace period) firms: block new client creation, but existing clients keep loading (no dashboard gate this pass — you asked to keep the gate off).

## Out of scope

- Actual live prices (you'll set them later).
- Self-serve signup — super-admin provisions firms and starts checkout.
- Annual pricing (add later once monthly is proven).
- Removing / migrating the old `client_subscriptions` table.

## Technical notes

- Uses seamless Stripe (already enabled) — no key entry required.
- Embedded checkout via existing `src/lib/stripe.server.ts` and `@stripe/react-stripe-js`.
- New migration adds `firm_subscriptions` with GRANTs + RLS + a data backfill for `is_always_free` firms.
- Webhook change is additive; existing `client_subscriptions` handler stays.
