# Subscription platform plan

## Model in plain English

Sold to **firms** (accountants, advisors). A firm subscribes to a **tier** = how many of their own clients' Xero files they can connect (5, 10, 20, 50). Signup is **invite-only** for now (switchable later) with a **7-day trial, card required**, auto-charged at trial end unless cancelled. The firm invites their end-clients as **viewers** of their own dashboard. **Positive Traction** is flagged `is_always_free`. **You (super-admin)** see a private list of firms with billing/usage — but never their Xero org names, financial data, or dashboards.

## Pricing tiers

| Tier | Xero files |
|---|---|
| Starter | 5 |
| Growth | 10 |
| Scale | 20 |
| Firm | 50 |

Hard cap on connections at the tier limit. Prices set in Stripe.

## New surfaces

```text
/                            Public landing (hero, value, pricing, request access, FAQ)
/auth                        Existing sign in
/signup/[token]              Accept invite → account → Stripe Checkout (trial, card required)
/billing                     Firm: plan, usage, invoices, manage / cancel (Stripe portal)
/admin                       Super-admin: firms, tier, usage, next bill, errors (NO Xero data)
/api/public/stripe/webhook   Stripe events (signature-verified, idempotent)
```

## Roles

Extend `app_role`:
- `super_admin` — you. Sees `/admin`. **Cannot** open firms' Xero data.
- `firm_owner` — subscriber; manages billing + invites.
- `firm_staff` — additional firm logins (later).
- `client_viewer` — existing end-client viewer.
- `advisor` (existing) → migrated to `firm_owner`.

## Data model (new tables)

```text
firms              id, name, owner_user_id, is_always_free, created_at
firm_members       firm_id, user_id, role
subscriptions      firm_id, stripe_customer_id, stripe_subscription_id,
                   tier, status, trial_ends_at, current_period_end, cancel_at_period_end
billing_events     firm_id, stripe_event_id (UNIQUE), type, payload, occurred_at
access_invites     token_hash, firm_id, email, role, expires_at, accepted_at
signup_requests    email, firm_name, note, status, created_at
audit_log          actor_user_id, action, target_type, target_id, ip, ua, at  (append-only)
```

Existing `clients`, `xero_connections`, `client_xero_orgs` get `firm_id`.

## Core guarantees (non-negotiable)

1. **Xero is read-only, forever.** Only `*.read` OAuth scopes. The OAuth URL builder has a code-level assertion that rejects any non-`.read` scope; CI fails if a write scope is added. Documented in security memory so future changes can't quietly grant write access.
2. **Database lives only on Lovable Cloud.** Single managed Postgres, encrypted at rest, daily platform backups. No external warehouse, no analytics pixels, no exports unless you trigger one. Data leaving the DB is limited to: Stripe (billing metadata only, never Xero data), Xero API (read calls + cached responses back), transactional email (name + email only).
3. **Super-admin cannot see any firm's Xero data — enforced by the database, not just the UI.**

## Security architecture — four layers

### Layer 1 — Database (RLS is the source of truth)

- RLS on every table; no policy = no access.
- Firm-scoped tables (`clients`, `xero_connections`, `client_xero_orgs`, `report_cache`, `unreconciled_*`, `client_notes`, `dashboard_*`) use policies of the shape `firm_id IN (SELECT firm_id FROM firm_members WHERE user_id = auth.uid())`. `super_admin` is **not** granted select on these.
- Billing tables readable by firm members for their own firm + `super_admin` for all.
- Dedicated SQL view `admin_firm_overview` exposes ONLY: firm name, tier, connection count, status, next bill date, trial state, error counts. No tenant_id, no Xero org names, no client names. This is the only thing `/admin` queries.
- All policy helpers (`has_role`, `has_firm_access`, etc.) are `SECURITY DEFINER` with `search_path = public` and **must query a different table than the one they protect** (avoids infinite recursion).
- Every new `public.` table = `GRANT` + `ENABLE RLS` + policies in the same migration.

### Layer 2 — Server functions (defence-in-depth)

- Every protected `createServerFn` uses `requireSupabaseAuth` + explicit ownership check (`has_firm_access(userId, firmId)`); never trust client-supplied `firmId`.
- Admin fns assert `has_role(userId, 'super_admin')` and only call `admin_firm_overview`. **No admin server fn that returns Xero data exists** — the code path simply isn't there.
- `supabaseAdmin` imported **inside handlers only**, never at module scope.
- Zod validation on every input: length caps, regex on identifiers, enum on tiers.

### Layer 3 — Secrets and tokens at rest

- Xero `access_token` / `refresh_token` encrypted via **pgcrypto** (`pgp_sym_encrypt`) using a server-only key `XERO_TOKEN_ENC_KEY`. Even a service-role read returns ciphertext; decryption happens inside server fns that already passed the firm check. One-off rotation path included.
- `access_invites` stores **only a hash** of the token; the raw exists only in the email.
- Stripe webhook secret, Xero client secret, service-role key — all server-only `process.env`, never `VITE_*`.

### Layer 4 — Network, billing, abuse

- `/api/public/stripe/webhook` verifies `stripe-signature` with `timingSafeEqual` before any write; idempotent on `stripe_event_id` UNIQUE.
- Xero OAuth callback validates `state` and asserts the caller belongs to the firm starting the connection.
- Auth hardening: enable Supabase **HIBP leaked-password check**, sensible password minimum, email confirm ON, no anonymous sign-ups, OTP expiry ≤ 1h.
- Rate limits on signup, invite accept, webhook, Xero connect (simple per-IP/per-user counters in Postgres).
- Security headers in `__root.tsx` + server responses: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP report-only first, then enforced.

### Audit & monitoring

- `audit_log` writes on: login, role change, invite created/accepted, Xero connection created/deleted, subscription state change, super-admin actions. Append-only.
- Super-admin can read `audit_log`, cannot delete.
- Supabase **security linter** run after each migration; fixes before shipping.
- Per-firm "Security & access" page shows the firm their own recent logins + connected files.

### What super-admin CAN and CANNOT do

| Can | Cannot |
|---|---|
| See firm name, tier, usage, billing status, next bill, error counts | See Xero org names, tenant IDs, balances, P&L, payables, receivables, transactions |
| Cancel/refund via Stripe | Open a firm's dashboard or `/clients/*` |
| Resend invites, change tier, mark `always_free` | Read or decrypt Xero tokens |
| View audit log | Delete audit log; impersonate a firm user (feature doesn't exist by design) |

The "cannot" column is enforced by RLS denying super_admin SELECT on those tables — not just hidden UI buttons.

### Pen-test checklist before launch

1. Sign in as `super_admin`, attempt `SELECT * FROM xero_connections` → expect 0 rows / permission denied.
2. Sign in as Firm A, pass Firm B's `firmId` to every server fn → expect rejection.
3. Replay an old Stripe webhook → expect idempotent no-op.
4. Tamper invite token → rejection.
5. Attempt OAuth with a write scope manually appended → builder rejects.
6. Supabase security linter + security scanner + security memory check — all green.
7. Service-role select on `xero_connections` confirms tokens are ciphertext.

## Stripe

- Lovable **Seamless Stripe Payments** (no BYOK).
- One Product, four recurring Prices (5/10/20/50), 7-day trial, `payment_method_collection=always`, AU `automatic_tax` on.
- Webhook handles `customer.subscription.*`, `invoice.payment_failed`, `invoice.paid`.
- Self-serve manage via Stripe Customer Portal.
- Past-due → lock dashboards behind "Update payment method" 7 days → cancel; connections retained 30 days for resume.

## Super-admin `/admin`

One row per firm: name, tier (e.g. "Growth — 10"), usage `7/10`, status, next bill date, trial days left, recent error count, always-free badge. Row click → billing & audit detail only. **No deep link into a firm's app.**

## Migration of existing users

1. One `firm` per existing `advisor` user (firm name = display name; editable).
2. Move their `clients` / `client_access` / `xero_connections` under that `firm_id`.
3. Insert `subscriptions` row `tier='legacy'`, `status='active'`.
4. Positive Traction firm: `is_always_free=true`.
5. Promote you to `super_admin`.
6. Re-encrypt existing Xero tokens with `XERO_TOKEN_ENC_KEY` in the same migration.

## Landing page (first pass)

`/` becomes marketing: hero, 3 feature blocks, pricing table, how-it-works, FAQ, "Request access" form → `signup_requests` → approve from `/admin` → emails an invite. Copy is placeholder; iterate later.

## Build phases (each independently shippable, review gate after each)

1. **Schema + roles + RLS + token encryption + audit_log + migration of existing data.** Linter green.
2. **Super-admin `/admin`** wired to the redacted view only.
3. **Stripe enablement + products + signed webhook + `/billing` + portal.**
4. **Invite + signup + trial gate + hard-cap on Xero connect + lock screens.**
5. **Landing page at `/`** (auth stays at `/auth`).
6. **Security hardening pass**: HIBP, headers, rate limits, CSP, pen-test checklist, write security memory.

## Decisions parked (not blockers)

- Exact AUD prices per tier (set in Stripe).
- Firm staff seat policy per tier.
- Annual pricing.
- Branded transactional emails.
