
## What's actually going on

This project uses **Lovable's built-in (seamless) Stripe integration**, not bring-your-own-key. That means:

- There is no field anywhere in Lovable or the app for `STRIPE_SECRET_KEY` — and there shouldn't be. The keys are managed for you.
- The "Stripe account" currently powering test-mode checkout is a **claimable sandbox** Stripe created on your behalf when payments were enabled.
- "Using my own Stripe account" happens by **claiming that sandbox into your existing Stripe login**, not by pasting credentials. Stripe then treats it as an account you own, and Lovable provisions live keys automatically once you finish onboarding.

No code or database changes are needed for this — everything happens in the Payments dashboard and on Stripe-hosted pages.

## Steps (all outside the code editor)

1. **Open the Payments dashboard in Lovable** and switch to the **Live** tab. You'll see 5 go-live steps.
2. **Step 1 — Claim account:** click the claim button. It opens a Stripe-hosted page titled *"Create a Stripe account to claim this sandbox from Lovable"*. Choose **Sign in** (top of the page) instead of Create account, and log in with your existing Stripe credentials. The sandbox is now attached to your account.
3. **Step 2 — Activate for live:** Stripe walks you through business verification, bank details for payouts, 2FA, tax settings, and review/submit. If your existing account is already activated, most of this is pre-filled.
4. **Step 3 — Install the Lovable app on your live account:** during the "Choose what to copy" screen at the end of step 2, tick **the Lovable app** (plus products/prices if you want the sandbox catalog copied to live). If you skip it there, step 3 gives you a separate install link.
5. **Steps 4 & 5 — Automatic:** Lovable provisions live API keys and webhook endpoints, then runs a readiness check. Nothing for you to do.

Until step 5 passes, checkout on the published site keeps running in **test mode** — the orange test-mode banner already in the app makes that visible.

## What I'll actually do in code

Nothing. The plan is intentionally zero code changes because:

- The Stripe client (`src/lib/stripe.server.ts`) already reads `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` from env, which Lovable populates automatically after go-live.
- The webhook route (`/api/public/payments/webhook?env=sandbox|live`) is already registered and will receive live events once step 4 runs.
- The `client_subscriptions` table already carries an `environment` column, so sandbox and live rows coexist cleanly.

## If you'd rather I do something in code

Two optional follow-ups I can pick up after go-live if you want them:

- **Copy the two products (Traction Standard A$99, Traction Advisory A$199) into live** — Stripe can do this via the "Choose what to copy" step, but I can also verify they exist in live via `payments--get_go_live_status` afterwards and re-create them if needed.
- **Sanity-check the go-live status from Lovable** and report back which of the 5 steps are done / blocked — useful if you get stuck partway.

Say the word after you've claimed the sandbox and I'll run the check.
