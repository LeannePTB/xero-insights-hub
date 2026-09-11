# Phase 1 — Enforce MFA (aal2) on the server

Owner-approved 11 Sep 2026 with corrections 1–9. Classification: SECURITY-RELEVANT
(auth/MFA, RLS, SECURITY DEFINER functions, public routes, client data).

## Problem

MFA was enforced only in the browser (`MfaGate`, `_authenticated/route.tsx`).
`requireSupabaseAuth` never read the `aal` claim, and no policy or function
referenced `aal`, so a password-only session — including the one minted by
"Sign in with Xero" — could call server functions and PostgREST directly.

## 1. Server functions

`src/lib/auth/require-aal2.ts` wraps the auto-generated `requireSupabaseAuth`
(never edited) and rejects any session whose token claim `aal` is not `aal2`.
Applied to all 213 authenticated server functions except the two aal1 logging
exceptions. Confirmation: `rg` shows `requireSupabaseAuth` imported only by the
wrapper and those two files.

## 2. Database scope (corrections 2, 3, 4)

Rule: a RESTRICTIVE `FOR ALL TO authenticated` policy `mfa_aal2_required`
(`app_private.is_aal2()`) on **every** `public` table `authenticated` holds any
privilege on, unless a documented pre-aal2 flow needs it. Already applied to 40
tables; this phase adds the remaining nine:
`tier_widget_config`, `security_settings`, `security_contact_details`,
`user_roles`, `email_send_state`, `email_unsubscribe_tokens`,
`rate_limit_buckets`, `suppressed_emails`, `xero_oauth_states`.

Excluded, owner-approved (item 9): `plan_levels`, `tier_settings` — public plan
and tier catalogue, no organisation, client or personal data.

Definer functions: 25 already guarded with `app_private.assert_aal2()`.
Correction 1 adds `public.xero_missing_scopes` (SECURITY DEFINER, reads
`xero_connections` for a caller-supplied id). `public.xero_required_scopes`
stays unguarded — it returns a fixed constant list and reads no table.

## 3. Pre-aal2 flows kept working

Supabase Auth API (sign-in, MFA enrol/verify, recovery) touches no `public`
table. Invite acceptance, `set-password`, `report.$token`, unsubscribe, the
Xero OAuth callback, Stripe webhook, cron snapshot refresh and the email queue
all run unauthenticated or through `service_role`, which bypasses RLS; the two
aal1 loggers write through `service_role`. `_authenticated` redirects to MFA
before any protected server function runs, so `getMyContext` never fires at
aal1.

## 4. Lockout safety (item 9)

Two of three super admins hold verified factors. The third enrols at next
sign-in through the Auth API, which the new guards do not touch. MFA reset
through the Admin → Security console is unchanged.

## 5. aal1 logging exceptions (correction 7)

`logAuthEvent`: action from a six-value allow-list, actor and email from the
token, `meta` carries only the token email, now rate limited 30/5 min per user.
`logLogin`: no input at all, all fields from the token/headers, now rate
limited 20/5 min per user. Both write-only, return `{ok:true}`.

## 6. Unauthenticated server functions (correction 8)

`getInvitePublic`, `acceptInvite` (invite acceptance before an account exists),
`logFailedSignIn` (failed sign-in, no session, rate limited), `getGreeting`
(template example, returns a constant), `describeReportLink`, `openReportLink`
(token-authenticated public report link), `startXeroSignIn` (begins OAuth
before a session exists). None reads organisation data without a token.

## 7. Verification (corrections 5, 6)

- Live non-aal2 token for a super admin who is an active member of all four
  organisations: zero rows from every in-scope table, `MFA_REQUIRED` from
  guarded functions. Baseline row counts captured through `service_role`.
- `app_private` exposed-schema evidence: PostgREST `db_schemas` setting and a
  live call to an `app_private` function over REST.
- `app_private.is_aal2()` truth table for aal1/aal2/service_role/no-claims.
- Supabase linter: no new finding types. Typecheck clean.

## 8. Docs

`docs/security/access-control.md` corrected; `docs/security-backlog.md` entry
closed with evidence and the owner decisions recorded.
