# Ready to sell — Legal & compliance pages + Xero certification

Two workstreams, in this order: legal pages first (small, no new access surface), then the Xero App Store certification gaps.

## Workstream A — Legal & compliance pages

1. **Privacy policy** (`/privacy`, public route)
   - Written for Traction Advisory in Australian English, covering: what data is held (account details, client Xero financial and payroll data), why, who can see it (the access paths), retention, and the sub-processor list from `docs/security/data-hosting.md`.
   - Includes the **Singapore hosting disclosure** using the exact wording already agreed in `docs/security/data-residency-decision.md` (backlog 45).
   - Placeholder contact details flagged for you to confirm before publishing.
2. **Terms of service** (`/terms`, public route)
   - Plain-English terms: subscription, fair use, read-only Xero access, client responsibility for their data, liability, termination.
3. **Security page check** — `/security` already exists; review it against the current posture and link all three pages from the sign-in page and public footer.
4. **Incident register** — create `docs/security/incident-register.md` (empty, with the recording format) so the register exists before an assessor asks (assessment gap: "no incident register exists").
5. **Restore test record** — document a tested backup restore with RPO/RTO in `docs/security/backup-and-restore.md` (assessment gap; the test itself needs your Lovable Cloud access).

## Workstream B — Xero App Store certification (from the approved 8 Oct plan)

Order as approved: smallest first.

1. **Client-visible Xero sync status** (work item 2)
   - "Xero sync status" section on client settings: last successful refresh, last failure time, plain-English reason derived server-side from the stored error category.
   - New caller-scoped, aal2-guarded database function returning only that client's sanitised status; no raw API bodies, no tokens, no new access path.
   - Overview "data" feed events link to it.
2. **Connection cleanup routine** (work item 3)
   - Scheduled job (registered system context) listing Xero connections via client-credentials grant, flagging tenants with no active client link or off-boarded organisation.
   - Dry-run first: the first run only reports what it *would* detach for your review.
   - Detach uses the existing verified `detachTenantFromXero` path (DELETE connection, never token revocation), each detach audit-logged.
3. **Sign Up with Xero + Sign in with Xero** (work item 1, largest)
   - New public `/xero-signup` route (the App Store "connect request url"): starts a Xero OAuth redirect with OpenID scopes only and a signed, expiring state parameter.
   - New callback exchanges the code, reads identity (name, email, Xero user id), redirects to sign-up pre-filled. No tokens stored, no tenant scopes at this point.
   - Existing email → asked to sign in normally; no automatic account merging. MFA enrolment unchanged.
   - "Sign in with Xero" button on the login page, matched by verified email; MFA still required after it.
4. **Portal checklist for you** (cannot be done from code): app name/go-to-market match, launcher login URL, official Xero Connect/Disconnect button artwork, then submit to Xero.

## Security Gate (every item)

- Classification: SECURITY-RELEVANT (public routes, Xero OAuth, email, new definer functions).
- Each item ends with: `bun run security:check` green (incl. 18 live checks), Supabase linter, security report, `docs/security-backlog.md` updated.
- Invariants held: server-side aal2, caller-supplied IDs are filters, tokens never leave the server, supabaseAdmin only in registered system contexts.

## Verification

- `bunx tsgo`, build, `bun test src tests`, full security checks after each item.
- End-to-end preview check of the Xero sign-up flow before you submit to Xero.
- Legal pages reviewed by you (and your privacy adviser, per the residency decision) before publishing — I draft, you approve the wording.

## Not in scope

- Payments/self-serve Stripe signup and ops housekeeping (support contact, monitoring) — parked for a later plan.
- Xero App Store billing API (you use Stripe).
- The debtor-ageing defect and key-figures retention decisions (awaiting your call).

---

## Status — 13 Oct 2026

**Workstream A — done, except the owner-only items.**
- `/privacy` and `/terms` built and linked from the sign-in page (both footers) and the security page; verified rendering in a browser. The privacy policy carries the agreed Singapore disclosure wording and sub-processor list. Contact addresses (`privacy@`, `hello@tractionadvisory.com.au`) are placeholders for the owner to confirm.
- `docs/security/incident-register.md` created (empty, with format).
- Restore test record: NOT done — the test itself needs the owner's Lovable Cloud access. Still open in `docs/security/backup-and-restore.md`.

**Workstream B — all three code items were already built and verified in earlier turns:**
- Client-visible Xero sync status: `getClientXeroSyncStatus` (aal2, caller-scoped RLS reads, plain-English reasons) rendered by `XeroSyncStatusCard` in client settings → Xero. One gap fixed this turn: overview data-feed events (Xero disconnected, overnight refresh failed, snapshot out of date) now link to `/clients/:id/settings/xero` instead of the general settings page.
- Connection cleanup routine: `cleanupXeroConnections` + cron route `/api/public/xero/connection-cleanup`, registered in `admin-client-register.md`, dry-run until `XERO_CONNECTION_CLEANUP_LIVE="true"`. Owner decision pending: review a dry-run report, then enable live detaches.
- Sign Up with Xero (`/api/public/xero/signup`, flow='signup', identity only, pre-fills request access) and Sign in with Xero (button on `/auth`, flow='signin', verified-email match, MFA still required) — both live; the sign-in button verified rendering.

**Remaining (owner, not code):** Xero developer portal checklist (app name, launcher login URL, official button artwork, submit); engagement-letter disclosure wording; privacy-adviser APP 8 check; restore test; enabling live connection detaches after reviewing a dry run.

**Verification this turn:** `bunx tsgo` clean; build OK; `bun run security:check` 215 tests and 18 live checks, 0 failures, known-failure list unchanged. (The full `bun test src tests` parallel run shows a pre-existing PGlite `window.location` flake in `rls-isolation.test.ts`; the file passes standalone and inside `security:check`.)
