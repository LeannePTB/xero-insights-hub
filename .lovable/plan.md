## Goal

Strip out the Lovable-managed Stripe integration (gateway-proxied SDK, managed webhook, checkout/portal server fns, billing UI). Leave firm plan tiers (Starter/Growth/Scale/Firm) and client quotas in place so you can bolt on your own Stripe account later without redoing that work.

## What gets removed

**Code**
- `src/lib/stripe.ts` — client-side Stripe.js loader keyed to `VITE_PAYMENTS_CLIENT_TOKEN`
- `src/lib/stripe.server.ts` — gateway-proxied Stripe SDK client + webhook verifier
- `src/lib/billing.functions.ts` — `createCheckoutSession`, `createPortalSession`, etc.
- `src/routes/api/public/payments/webhook.ts` — Stripe webhook handler
- `src/routes/_authenticated/admin.billing.tsx` — admin billing page + its sidebar link
- `src/components/billing/SubscriptionPanel.tsx`, `SubscriptionGate.tsx`, `SubscriptionStatusBadge.tsx`, `SubscriptionBadge.tsx`
- `stripe` and `@stripe/*` npm packages
- Any `PaymentTestModeBanner` mount

**Refactors (don't delete, just decouple from Stripe)**
- `src/lib/clients.functions.ts` — drop the `client_subscriptions` join used to hydrate `c.subscription`; keep the client list + quota check via `firmPlans`
- `src/routes/_authenticated/firms.$firmId.tsx` — remove Plan / Due Date / Status columns and `SubscriptionStatusBadge` import; keep Client / Tiers columns
- `src/routes/_authenticated/dashboard.tsx` — firm cards keep name + `used / limit` client usage bar, drop status/renewal date
- `src/lib/admin.functions.ts` — drop the `billing_events` query from `getFirmDetail`
- `src/routes/_authenticated/admin.firms.$firmId.tsx` — remove `BillingSection` and its render

**Kept as-is**
- `src/lib/firmPlans.ts` (tier labels + `clientLimitFor` quotas)
- `client_subscriptions` and `billing_events` DB tables (untouched — no destructive migration; ready to repopulate when you connect your own Stripe)
- `admin.firms.$firmId` tier picker

## What you'll do yourself later

When you're ready to plug in your own Stripe account, tell me and I'll add a fresh integration using your `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — no gateway proxy, direct SDK, your keys stored via `add_secret`.

## Verification

- Typecheck passes
- `/dashboard`, `/firms/$firmId`, `/admin`, `/admin/firms/$firmId` load without runtime errors
- No remaining `import ... stripe` or `VITE_PAYMENTS_CLIENT_TOKEN` references in `src/`
