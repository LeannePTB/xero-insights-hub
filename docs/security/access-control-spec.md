@@
-1. Deny by default. Every table with organisation/client/Xero data has RLS with explicit policies. Verified live: RLS is on for all 53 `public` tables.
+1. Deny by default. Every table with organisation/client/Xero data has RLS with explicit policies. Verified live: RLS is on for all 63 `public` tables.
@@
-12. `authenticated` holds only the privileges the policies on that table admit (§14).
+12. `authenticated` holds only the privileges the policies on that table admit (§14). `scripts/check-table-security.ts` enforces this from the live-catalogue fixture before release and rejects anonymous privileges unless explicitly allow-listed.
@@
-- **Database.** `app_private.is_aal2()` reads the `aal` claim from the request JWT. A RESTRICTIVE `FOR ALL TO authenticated` policy `mfa_aal2_required` sits on **51 of the 53 `public` tables** (verified live), with two owner-approved exclusions holding no organisation, client or personal data: `plan_levels` and `tier_settings`. Requests with no JWT claims (cron, migrations) and `service_role` requests are system contexts, which bypass RLS anyway.
+- **Database.** `app_private.is_aal2()` reads the `aal` claim from the request JWT. A RESTRICTIVE `FOR ALL TO authenticated` policy `mfa_aal2_required` sits on **60 of the 63 `public` tables** (verified live). The three documented exclusions are `plan_levels` and `tier_settings` (legacy non-data catalogues), plus `session_activity`, which `is_aal2()` itself reads to enforce inactivity and therefore cannot carry the guard without recursion. Requests with no JWT claims (cron, migrations) and `service_role` requests are system contexts, which bypass RLS anyway. The pre-release table-security guard fails when a new table omits this policy or receives a data privilege not admitted by a matching permissive policy.
# Traction Advisory — Access Control Spec (the detail)

> **What this file is for.** The DETAIL behind the rules: how each rule is implemented, and the
> facts that have caused incidents before. Updated 12 September 2026 (Phase 7 batch 3) to match the
> system as built through Phases 1–7.
>
> **Which document wins.**
>
> - **Project Knowledge** ("Security Rules and Change Gate") — the BINDING rules the agent follows. It wins over everything here.
> - **This file** — the detail. Where it and Project Knowledge differ, Project Knowledge wins.
> - **`access-matrix.ts` / generated `access-matrix.md`** — the EVIDENCE. Where this file and the matrix disagree, the matrix is right: it is proved against the live catalogue by `bun run security:check`, and prose is not.
> - **`access-control.md`** — the assessor-facing summary. Never authoritative.
>
> Supporting generated/verified registers: `definer-register.md` (every SECURITY DEFINER function, its guard and its callers), `admin-client-register.md` (every `supabaseAdmin` use and its reason), `grant-dump-phase7.md` (before/after grants), `docs/security-backlog.md` (open work and settled decisions).

Xero-connected multi-tenant advisor dashboard subject to the **Xero API Consumer Security Standard**. Access control is the highest-risk area of this codebase.

If a chat request conflicts with this document, STOP and reply:
"That conflicts with the Access Control Spec, section X. Do you want to amend the spec?"

## 0. Invariants — must hold after EVERY change

1. Deny by default. Every table with organisation/client/Xero data has RLS with explicit policies. Verified live: RLS is on for all 63 `public` tables.
2. No policy on a data table may read `USING (true)`. New permissive policies are per command, never `FOR ALL`; a RESTRICTIVE `FOR ALL` guard that only narrows access (the aal2 guard) is allowed.
3. **Being `super_admin` grants ZERO access to organisation or client data on its own** (see §4a for the bounds on what it _can_ do).
4. A `firm_id` / `client_id` / `tenant_id` from the caller is a FILTER, never a GRANT.
5. Xero OAuth tokens never leave the server. `service_role` key never reaches the browser.
6. RLS is never disabled to fix a bug. Never cache roles or grants in the JWT or localStorage.
7. **Each rule has ONE implementation, in the database.** Server code calls it, never reimplements it — including plan limits and ownership. The build enforces this (§6a).
8. Fail closed. Showing no data is a bug; showing the wrong organisation's data is an incident.
9. **MFA is enforced on the server**, not by the browser (§0a). The browser gate is UX only.
10. **Support grants are READ-ONLY everywhere** (§7).
11. **Every read of a client's financial figures is audited** (§9a).
12. `authenticated` holds only the privileges the policies on that table admit (§14). `scripts/check-table-security.ts` enforces this from the live-catalogue fixture before release and rejects anonymous privileges unless explicitly allow-listed.

## 0a. MFA (aal2) is enforced on the server — three layers

`MfaGate` and the `_authenticated` layout are UX only; nothing depends on them.

- **Server functions.** `requireAal2` (`src/lib/auth/require-aal2.ts`) wraps the generated `requireSupabaseAuth` and rejects any session whose `aal` claim is not `aal2`. It guards every authenticated server function except two owner-approved logging exceptions, `logAuthEvent` and `logLogin`, which record the sign-in and MFA lifecycle itself before a second factor can exist: both are write-only, derive actor and email from the verified token, accept no caller free text (six-value allow-list; `logLogin` takes no input) and are rate limited via `public.check_rate_limit`. Seven functions are deliberately unauthenticated (Xero sign-in start and callback, the public report link, the webhook and cron routes) and each verifies its own credential.
- **Database.** `app_private.is_aal2()` reads the `aal` claim from the request JWT. A RESTRICTIVE `FOR ALL TO authenticated` policy `mfa_aal2_required` sits on **60 of the 63 `public` tables** (verified live). The three documented exclusions are `plan_levels` and `tier_settings` (legacy non-data catalogues), plus `session_activity`, which `is_aal2()` itself reads to enforce inactivity and therefore cannot carry the guard without recursion. Requests with no JWT claims (cron, migrations) and `service_role` requests are system contexts, which bypass RLS anyway. The pre-release table-security guard fails when a new table omits this policy or receives a data privilege not admitted by a matching permissive policy.
- **Callable functions.** Every SECURITY DEFINER function callable by a signed-in user asserts aal2 in its body via `app_private.assert_aal2()`, with one approved exception, `public.xero_required_scopes()`, which returns a fixed constant and reads no table. `public.xero_missing_scopes` returns `null` unless `app_private.is_aal2()`. All 127 definer functions set `search_path`. See `definer-register.md`, regenerated by `bun run security:check`.
- `app_private` is not an exposed PostgREST schema: a request with `Accept-Profile: app_private` returns `PGRST106`.

## 0b. Daily 3am sign-in cut-off — REMOVED (15 Sep 2026, owner decision)

**The session controls are now: a 30 minute inactivity timeout, enforced on the
server and in the database, plus sign-out on demand.** There is no daily forced
sign-in.

Introduced 14 Sep 2026, removed 15 Sep 2026. **Reason recorded by the owner:** the
inactivity timeout (§ 0c) addresses the stolen-device threat directly — an
unattended or stolen device loses its session within 30 minutes, whatever the time
of day — while a daily forced sign-in added friction for everyone without covering
that threat. It was also mistaken for a sign-in fault when a person could not get
back in.

Removed in the same change, in every layer: `app_private.is_session_fresh()`
(dropped; only `is_aal2`, `assert_aal2` and `session_controls_posture` ever called
it, all rewritten), the freshness term in `app_private.is_aal2()`, the
`SESSION_EXPIRED` branch of `app_private.assert_aal2()`, `dailySignInMiddleware`
in `src/start.ts`, the `_authenticated` gate's staleness sign-out, the `/auth`
stale-session sign-out, the `ta:signin-at` / `ta:signin-expired` browser hints and
their helpers, the "Daily sign-in required" copy, and the matrix rows for the
`stale_session_member` role. The `session_controls` posture check now asserts the
removal is complete and reports the inactivity window only, so it cannot read OK
for a control that no longer exists. **Nothing in § 0c changed**: the inactivity
timeout, its table, its helpers, its window, its warning, its cross-tab handling,
the request-layer check and the distinct `SESSION_IDLE` code are all untouched.

- **Sign out.** `useSignOut` (`src/lib/use-sign-out.ts`) records the event best-effort, clears the local inactivity deadline and returns to `/auth`. `AppHeader` carries the button and marks itself `data-app-header`; `GlobalSignOut` supplies a floating button on the routes that render no such header (including the `AdminShell` pages), and the public `/auth` page offers Sign out to an already signed-in visitor.

## 0c. 30 minute inactivity timeout and remote sign-out (15 Sep 2026, owner decision)

This is the **only** automatic end to a session: it ends after **30 minutes
without real activity**, with a warning at 29 minutes.

**Enforcement history.** Database and request-layer enforcement were suspended
15 Sep 2026 at 02:24 during the lockout described in backlog 51 (nothing was
recording activity, so every session was resolved from its sign-in time alone)
and **re-enabled the same day, 04:50 UTC**, only once all four owner-required
proofs held: (1) a real signed-in session writes an activity row and keeps
updating it (owner's live session, sign-in 02:35, activity updating to the second
of the check); (2) a session actively used well past the window is still
accepted — positive regression role `active_session_member` (session 90 minutes
old, activity 2 minutes old) asserted on a client-scoped read, on
`assert_aal2()` and on its own activity write, failing with "this is the lockout
condition"; (3) a genuinely idle session beyond the window is refused; (4) a
brand-new session with no activity row is accepted from its own start time.
Sessions that began before the corrected recording code was published carry no
activity history and are treated as idle: those people sign in once more.

**Cannot-tell handling (owner decision, 15 September 2026).** Three cases,
deliberately answered differently, and **none of them changed what the database
accepts** — the answers below are the answers that were already given:

1. **Unreadable session identity** (no `session_id` claim): refused. An
   unverifiable claim is what an attacker supplies; no legitimate session is in
   this state.
2. **Readable identity, no activity record, session older than the window:**
   refused, as before. Treating it as active would make the control bypassable by
   simply preventing the write. What changed is only the experience and the
   visibility: the person is signed out cleanly and told "Your session ended —
   please sign in again" — never "Admin access required" (which the owner was
   shown during a client demo), never a generic failure and never a dead end.
   Any `SESSION_IDLE` answer reaching the browser is handled once at the query
   client (`src/lib/session-ended.ts`), so no page can mistranslate it, and
   `/auth` asks the server before offering an existing session back.
3. **The request layer cannot reach the database to ask:** it does not refuse —
   it logs that it could not tell and passes the request on, because the database
   itself answers the same question on every query and every guarded function a
   moment later. This layer is deny-only and never the control.

Failures are visible, never swallowed: a failed activity write logs its reason
server-side and in the browser (never a token, session id or email), a
request-layer refusal is logged, and `session_controls_posture()` reports live
sessions past the window with **no** activity record — zero is healthy, any count
raises a Warn naming the number and the oldest. That single signal is what was
missing on 15 September: the recorder was broken for hours and the first
indication was people being locked out.

- **Database (the enforcement point).** `public.session_activity` holds one row
  per session: `session_id` (primary key), `user_id`, `last_activity_at`. RLS on;
  `anon` and `authenticated` hold no write privilege at all — signed-in people may
  only read their own row. `app_private.is_session_active()` (STABLE SECURITY
  DEFINER, `SET search_path`, registered) reads the `session_id` claim and returns
  `coalesce(last_activity_at, auth.sessions.created_at) > now() - interval '30
minutes'`, so signing in counts as activity until the first recorded
  interaction. No request context and `service_role` are system contexts and pass.
  It **fails closed**: a missing `session_id` claim, or a session row it cannot
  find (including one revoked in the authentication service), is idle.
  `app_private.is_aal2()` requires it, so the RESTRICTIVE `mfa_aal2_required`
  policy hides every row on every data table from an idle session.
  **Documented exclusion, not an exemption:** `public.session_activity` itself and
  `public.session_is_active()` are named exclusions in the `aal2_tables` and
  `definer_guards` posture checks, because the aal2 gate reads that table and that
  function to decide whether a session is idle — requiring aal2 of them would be
  circular. Both exclusions are printed in the evidence text on the Security page.
  The table's own protection is unchanged: RLS on, no `anon` privilege, own-row
  read only, no INSERT/UPDATE/DELETE privilege for signed-in users, and a session
  id, user id and timestamp are the only data it holds.
- **A distinct reason code.** `app_private.assert_aal2()` raises **`SESSION_IDLE`**
  and then `MFA_REQUIRED` (the `SESSION_EXPIRED` branch went with § 0b). An idle session
  must never report `MFA_REQUIRED` — that sends a person to their authenticator
  app when they need to sign in again. The two places that translate the MFA code
  for people (`explain()` in `src/lib/ownership.functions.ts` and
  `src/lib/viewers.functions.ts`) carry a `SESSION_IDLE` branch **before** the MFA
  branch; nothing else keys off the MFA string.
- **Writing activity.** Only `public.touch_session_activity()` writes
  `last_activity_at`: SECURITY DEFINER, asserts aal2, takes the session from the
  verified token claim (never a parameter) and the time from the server clock, and
  upserts only where `user_id = auth.uid()`. An idle session cannot revive itself,
  because the aal2 assertion fails first. No caller-supplied session, user or
  timestamp is accepted anywhere.
- **What counts as activity.** Real interaction only: `pointerdown`, `keydown` and
  route navigation, debounced to at most one server call a minute. Deliberately
  **excluded**: the presence heartbeat, dashboard snapshot refresh, token refresh
  and every polling query. A tab left open on a dashboard therefore still times
  out, and a closed laptop is already expired when it wakes.
- **Request layer (Layer 3b, deny-only).** `inactivityMiddleware` in
  `src/start.ts` asks `public.session_is_active()` with the caller's own bearer
  token and returns a 401 carrying `x-session-state: idle`. A positive answer is
  cached 15 seconds per isolate; a refusal is never cached. If the database cannot
  be reached this layer allows and the database still refuses — it can only ever
  deny earlier, never grant.
- **Browser (UX only).** `SessionIdleGuard` keeps an **absolute** deadline in
  `localStorage` (`ta:idle-deadline`) shared across tabs over a
  `BroadcastChannel` (`ta:session`), so activity in one tab extends all of them
  and expiry ends all of them. At 29 minutes it shows a countdown with "Stay
  signed in" (which calls `touch_session_activity()`) and "Sign out now". On
  expiry it signs out and lands on `/auth`, which shows "Signed out after 30
  minutes of inactivity" — never an MFA prompt.
- **Sign out my other devices (self-service).** `Settings → Account` calls
  `supabase.auth.signOut({ scope: "others" })`, which deletes the person's other
  sessions in the authentication service; the current device is untouched. This is
  true server-side revocation, not browser clearing: the revoked session's refresh
  token stops working, and `is_session_active()` fails closed once the
  `auth.sessions` row is gone, so the token is refused everywhere.
  `public.record_sign_out_other_devices()` audits who and when — never a token or
  device detail.
- **Sign another person out of every device (super admin, stolen device).**
  Mechanism, stated plainly: this platform's authentication service has **no**
  administrative sign-out endpoint (`POST /admin/users/{id}/logout`, `DELETE
/admin/users/{id}/sessions` and `POST /admin/users/{id}/sessions/logout` all
  return 404 against a **real** user id, verified 15 Sep 2026 with three live
  sessions still working afterwards), and a temporary ban is **not** a sign-out —
  it blocks while it lasts (403/400) but leaves the `auth.sessions` rows intact and
  the same refresh token works again once lifted. The one mechanism that genuinely
  ends every session is an admin credential change: measured taking that person's
  `auth.sessions` from **5 → 0**, all three sessions refused. So the control sets a
  random password nobody holds and emails a reset link; the person chooses a new
  password before signing in again, and the on-screen confirmation says so.
  Authorisation is in the database: `public.admin_assert_can_sign_out_user(uuid)`
  (aal2 + super admin, refuses `auth.uid()` as its own subject — use the self
  control — and refuses the last remaining super admin).
  `public.record_sign_out_all_devices(uuid, text)` writes the
  `sessions_revoked_all` audit row with actor, subject, time and mechanism, only
  after the revocation succeeded, never a password or token. No `auth`-schema
  write is involved. Control: `Settings → Advisors`, per person.
- **Lockout assessment.** Revoking sessions never touches enrolled factors, so a
  super admin who signs their own devices out simply signs back in with password
  plus TOTP. The remote control does change the subject's password, which is why it
  refuses the last remaining super admin and refuses the caller's own account.
  There is no path by which these controls can lock the platform out of itself, and
  therefore no bypass, break-glass role or exception was added.

## 1. Naming and language

**Never use "firm" in user-facing copy.** The user-facing term is **"organisation"** (matching Xero). `firm` / `firm_id` / `firms` are internal identifiers only — tables, columns, functions, RPC parameter names, TypeScript symbols, routes, query keys. Do not rename them.

- **"Company" is taken**: a _company_ is an individual Xero entity belonging to a client. Hierarchy: **Organisation → Clients → Companies**.
- The `basic` tier is **"Standard"** in UI copy; do not rename the enum value.
- **Australian English**: organisation, authorise, cancelled, licence (noun). Prices in AUD.

## 2. Business model — read before designing anything

**Every client of Positive Traction gets their OWN organisation**, because the business owner needs to log in and see their own dashboard. Positive Traction super admins create and set these up as part of ongoing bookkeeping. Free by default (PTB plan); the client pays only to upgrade.

**Positive Traction owns a client organisation by default** and hands ownership over when the client is ready. After handover it stays on as `staff` so bookkeeping continues, and the client can remove it.

## 3. The three access paths — DO NOT COLLAPSE THESE

**Path A — membership.** An active `firm_members` row. How Positive Traction reaches organisations it set up and runs the books for, and how a client reaches their own. Disclosed in the member list, revocable. **Never use support access for an organisation Positive Traction set up.**

**Path B — support grant.** ONLY for an organisation Positive Traction is not a member of. **Read-only, everywhere and without exception** — see §7. One named person, max 72h, approved by that organisation's owner.

**Path C — platform operations.** Metadata only: organisation list, plans, billing events, signup requests, invites, audit log, user roles, `admin_firm_overview`, `xero_api_errors`, security posture. MAY use bare `me_is_super_admin()`. Must never expose Xero financial data. Path C **writes** are audited by a generic audit trigger on the Path C tables (Phase 3b).

If a feature seems to need cross-organisation visibility, ask which path it is first.

## 4. Organisation lifecycle

**Creation** must, atomically: insert `firm_members` for the creator (`role='owner'`, `status='active'`); set `firms.owner_user_id`; insert an inert rollback `subscriptions` row; insert `org_subscription_options` with the starting client allowance, purchase flags and billing mode; write an `audit_log` row. If any step fails, roll everything back. An organisation with no members and no owner is **stranded** — nobody can approve anything. This happened to "Autotek NSW" and needed manual repair.

**Handover** goes only through `public.transfer_organisation_ownership(_firm_id, _new_owner_user_id, _keep_previous_as_staff default true)`: caller must be current owner, new owner must already be an active member, previous owner is demoted to `staff` or removed. Writes its own audit row. Never transfer ownership by direct UPDATE, and never through a super-admin path — `authenticated` holds no UPDATE grant on `firms` at all. Assigning an owner where there is none (first acceptance) is allowed only when `owner_user_id` is null, and is audited, refusals included.

## 4a. Super-admin powers are bounded and audited

`super_admin` on its own reaches no organisation or client data (invariant 3). What it can do is bounded in the database and audited:

- **Self-join.** `public.admin_set_self_firm_membership` adds or removes the caller as a member of an organisation **Positive Traction still owns** — never an organisation handed over to a client — and audits every attempt.
- **Always-free.** `public.set_firm_always_free` is restricted to Positive Traction's own organisation (pinned to `4dcfd606-dce3-4674-923f-c5183ecae141`), **fails closed** if that organisation cannot be identified, requires a 3–500 character reason, and audits the change. That flag grants the _highest enabled_ tier, not Standard. **Never set `is_always_free` on a client organisation.**
- **Subscriptions and comps.** `client_subscriptions` has no browser write grant; changes go through audited aal2 RPCs that require a reason.
- **MFA reset, role changes, plan changes, audit exports** all write audit rows.

## 5. Organisation options and limits — enforced by database triggers

While `card_model_v2` is active, `org_subscription_options.client_limit` is the single source for both the client and Xero-file allowances. `app_private.firm_limits()` reads that field directly; `subscriptions.client_limit_override` and `plan_levels` remain inert rollback data and must not be presented or written by active screens.

New organisations start with a client allowance of 1, Advisory and Consolidation off, and bookkeeping billing. Purchased Advisory and Consolidation remain distinct from time-limited organisation trial grants. Starting a trial for an option already marked as purchased atomically moves that option from purchased to trialled; a cosmetic trial that grants nothing is not permitted. Client card ticks are never rewritten by this conversion.

Triggers on `clients` and `xero_connections` block over-limit inserts and fire even for `service_role`. Catch and present these; never reimplement the check:

- `PLAN_LIMIT_CLIENTS: this organisation's plan allows N client(s). Upgrade to add more.`
- `PLAN_LIMIT_XERO_ORGS: this organisation's plan allows N Xero organisation(s). Upgrade to connect more.`

An organisation with no `subscriptions` row has NO limits — assign a plan at creation.

## 6. Authorisation functions — use these, never hand-roll

Server code (service_role bypasses RLS, so these are mandatory) calls **caller-scoped** functions that take no user id from the caller and read `auth.uid()` themselves: `public.user_can_read_client`, `public.user_can_write_client`, `public.assert_client_write_access`, `public.user_can_access_tenant`, `public.assert_tenant_belongs_to_client`, `public.client_for_tenant`, `public.firm_access_path`, `public.client_entitlement`, `public.my_roles`, `public.my_firm_memberships`, `public.my_client_access`, `public.firm_support_grants`, `public.firm_support_viewer_state`, and the super-admin/advisor checks. `public.user_can_access_firm` and `public.user_can_access_client` are the older aliases; they are still live and superseded by the read/write pair (backlog 37 tracks retiring them as its own change).

RLS policies use `app_private.*`: `has_firm_access`, `is_org_owner`, `is_firm_owner`, `has_client_access`, `user_can_read_client`, `user_can_write_client`, `user_can_manage_client`, `firm_support_access_active`, `platform_staff_can_access_firm`, `user_can_access_tenant`, `has_tenant_access`, `client_for_tenant`, `firm_limits`, `is_aal2`.

Pattern: **read** = `has_firm_access(auth.uid(), firm_id) OR platform_staff_can_access_firm(auth.uid(), firm_id)`; **write** = `has_firm_access` only, because support access is read-only. Tenant-keyed tables use `user_can_access_tenant`; client-keyed reads use `user_can_read_client` and client-keyed writes `user_can_write_client`. New policies target `to authenticated`, never `public`, and are per command.

## 6a. One rulebook — the build blocks re-implementation

Invariant 7 is enforced, not just stated. `tests/static-guards.test.ts` (run by `bun run security:check`) fails the build on:

- a direct read of `user_roles`, `firm_members`, `client_access` or `firm_support_access` in a converted file (`docs/security/converted-files.ts`) — access questions must be asked of a database function;
- a `supabaseAdmin` use that is not a registered system context and is not preceded by a database authorisation call (`admin-client-register.md`);
- any read of `profiles.email` — identity comes from `auth.users` (invariant 10);
- a `tenantId`/`firmId`/`clientId` taken from a request body, query string or header and used as a grant;
- a callable SECURITY DEFINER function without an aal2 assertion, and a read path that stops writing its read audit row (§9a).

`docs/security/access-matrix.ts` is the authoritative expectation of who may read and write what; `bun run security:check` proves it against a PGlite copy of the live schema, policies, grants, definer bodies and triggers, with a fingerprint check that fails when the live catalogue drifts from the copy.

## 7. Support access (`firm_support_access`) — read-only everywhere

PK is `id`. `grantee_user_id` and `expires_at` are NOT NULL, with a CHECK capping expiry at 72h. Partial unique index on `(firm_id, grantee_user_id) WHERE granted AND revoked_at IS NULL`. **No unique constraint on `firm_id` alone** — never upsert on `firm_id`, never `.maybeSingle()` filtered only by it.

Staff insert a pending request for themselves only. Only `is_org_owner` may approve. **A super admin can never approve their own access.** Writes go through `context.supabase`, never `supabaseAdmin`.

What a live support grant may do (Phase 3a):

- **Read**: the organisation's dashboards and Xero-derived figures, **the client list (`clients`) and statutory accounts (`client_statutory_accounts`)** as well.
- **Write: nothing at all.** No client record, no note, no setting, no scenario, and **no branding** — the branding and logo paths (including clearing a logo, which is audited) require membership or client ownership, not a support grant. No policy, RPC or server function that writes may admit a support grant, which is why write policies use `has_firm_access`/`user_can_write_client` and never `platform_staff_can_access_firm`.

## 8. Entitlement (separate from access control)

`client_entitlement` returns `(tier, source, expires_at, in_grace)` evaluated at READ TIME — expired trials fall back to `basic` on the next request, no scheduled job. `subscription_type` is `paid | free_forever | trial`; the 3-month offer is a Stripe coupon (`duration=repeating, duration_in_months=3`), NOT a subscription type. Comps are super-admin only, require a reason, and write an audit row.

**Entitlement must never widen who can SEE a client's data.**

Stripe: the practice's OWN account — `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (server only), `VITE_STRIPE_PUBLISHABLE_KEY`. `STRIPE_SANDBOX_API_KEY` is a different account, never a fallback.

## 9. Logging — telemetry vs audit

**`audit_log` is access and security events ONLY**, append-only: sign-ins, invites, membership and role changes, ownership transfers, support grants, comps, Xero connect/disconnect/token refresh/refusal, Path C administrative writes, and the client-data read events in §9a.

**Who may read `audit_log`: only Positive Traction super admins, at aal2.**

> **Settled owner decision, 12 September 2026 — an organisation may NOT read its own audit log.** This is deliberate, and current behaviour already matches it; earlier wording in this file that implied otherwise was wrong. Reasoning: `audit_log` is a single platform-operations trail spanning every organisation. Its rows describe Positive Traction's own operational actions and reference other organisations' identifiers, so exposing "your organisation's rows" would mean filtering a cross-tenant security trail per request — a new access path, and one more place to get wrong (invariants 3 and 6). Organisations that need assurance are given a report or an extract by the practice instead. Revisiting this needs the owner to amend Project Knowledge first.

**`xero_api_errors` is disposable telemetry**: one row per `(day, path, http_status, tenant_id, firm_id)` with an `occurrences` counter, 30-day retention pruned on write. Write ONLY via `public.log_xero_api_error(...)` (service_role). No in-code deduplication. Never pass tokens, headers or payloads. Telemetry failures are swallowed.

## 9a. Reads of client financial data are audited (Phase 6)

Every path that shows a person a client's figures records the read through the single writer in `src/lib/audit.server.ts`. Never write a read action directly, and never add a figures-serving path without it — static guard 7 fails the build if you do.

- **Actions:** `xero_data_read` (Xero figures, however served) and `client_report_read` (a stored report or a public report link, where the target is a report row and the link viewer has no signed-in actor).
- **Sources:** `live`, `snapshot`, `cache`, `report`, `report_link` (`src/lib/audit/read-keys.ts`).
- **Each row records:** who read it (or that there was no signed-in person), which client, which Xero file (tenant), a short stable key for the kind of figures (`pnl`, `receivables`, `report:monthly`), the period or date range where one applies, and the access path.
- **Each row never contains:** a figure, an account or contact name, a token (including the report-link token), an IP address or a device.
- **Grouping:** one row per `(actor, client, tenant, key, source)` per **five minutes**, in process, so one dashboard view is one row per kind of figures. A different person or a different client always writes its own row.
- **Failure:** an audit write failure is swallowed and logged — it never breaks a dashboard — which is why coverage is checked rather than assumed: `public.read_audit_posture()` (super admin, aal2) compares the trail against the reads actually served, and the Security card shows it.
- Retention follows `security_settings.audit_retention_days` (730 days live), purged by the nightly job.

## 10. Xero rules

- Resolve `tenant_id` SERVER-SIDE from the organisation/client the user is authorised for. **Never read tenantId from a request body, query string or header.**
- Tokens live in `xero_connections.access_token_enc` / `refresh_token_enc`, wrapped with AES-256-GCM under the server-only `TOKEN_ENC_KEY`. Never `select *` from `xero_connections` in client-reachable code; `authenticated` has SELECT on the 13 non-token columns only.
- Refresh tokens rotate; store atomically, row-lock against concurrent refresh. Only a definitive `invalid_grant` marks a grant revoked.
- On 401/403: `status='disconnected'`, stop syncing, prompt reconnect. No retry loops.
- **A connection always belongs to an organisation.** `xero_connections.firm_id` is `NOT NULL`, deferred constraint triggers keep a Xero file in the same organisation as the client it is linked to, and the connect callback **refuses** a tenant it cannot place, or one the plan has no room for, instead of storing it unassigned (audited `xero_file_refused`). Unlinking keeps the organisation stamp.
- **Disconnection** (`public.user_can_disconnect_xero_connection` authorises the caller): revoke at Xero FIRST via `DELETE /connections/{connectionId}`, verify the connection is gone, and **fail closed** — if Xero does not confirm, change nothing and tell the person. Then **mark** the row `disconnected`; **never hard-delete it**, because `client_xero_orgs.xero_connection_id` is `ON DELETE CASCADE` and deleting destroys the client-to-Xero-file link. Keeping the link means a reconnect restores the same file to the same client. Both success and failure are audited. A disconnected connection does not count toward the plan's Xero file allowance (`app_private.client_xero_files_used`).
- **`Reports/ActivityStatement` DOES NOT EXIST** — never call it. Current BAS figures are not available from the Xero API at all.
- `Reports/BankSummary` requires `toDate - fromDate <= 365 days`.
- `accounting.journals.read` is unavailable.

## 11. Membership & invites

`firm_members.status` is `active | suspended | removed`; role is `owner | staff`. Removal sets status, never hard-deletes; only `active` counts. Invites are email-bound, single-use, expiring, storing a token HASH. Team member and client viewer invitations share the People section in organisation settings, and each path keeps its own server function and permissions — grouping them in the UI widened nothing. The section renders only for an active organisation member; support access does not expose it. An owner invite is refused for an organisation that already has an owner.

## 12. Roles and identity

Roles live in `public.user_roles` (never on `profiles` or a users table) and are read through `has_role(uuid, app_role)` and `me_is_super_admin()`. **Identity comes from `auth.users`**: never use `profiles.email` or a display name to identify a person or choose a recipient — `profiles.display_name` is self-chosen and can imitate someone else, so a verified `auth.users` email accompanies the name in tooltips and admin lists.

## 13. Grants — only what the policies admit

Verified live on 12 September 2026 (Phase 7 batch 1; before/after dump in `grant-dump-phase7.md`):

- `anon` holds **no** privilege on any `public` table.
- `authenticated` holds **no** TRUNCATE, REFERENCES, TRIGGER or MAINTAIN on any table (was 47 tables), and no privilege at all on system-only tables.
- Every remaining `authenticated` grant has a matching permissive policy; a grant with no policy behind it is a defect.
- `service_role` grants are intact for system contexts; sensitive columns keep column-level grants.
- New table checklist: RLS on; `revoke all ... from anon, authenticated;` then grant only what the policies need; per-command policies; column grants for sensitive columns; add rows to `access-matrix.ts`.

## 14. Outstanding work

The verified security backlog lives in `docs/security-backlog.md`. Read it before planning any access-control work, and update it in the same change that closes an item. Do not track outstanding work in this document — this section only points at it.

Settled decisions there, not tasks: **`FORCE ROW LEVEL SECURITY` is WON'T DO** (all `public` tables are owned by `postgres`, which has `rolbypassrls`, so FORCE changes nothing for any role the app connects as); **token column exposure is CLOSED** (`authenticated` has SELECT on 13 non-token columns of `xero_connections`; `access_token_enc` and `refresh_token_enc` have no grant, and the privilege check precedes RLS); **an organisation may not read its own audit log** (§9); and the remaining super admin without a verified TOTP factor is **left as is** — she is forced to enrol at her next sign-in, server enforcement already blocks her from all data, and the posture card correctly shows one Action item until then.

## 15. Working agreement

One change at a time. After anything touching auth, RLS, membership, grants, entitlement, ownership or Xero tokens, restate which invariants in section 0 it touches and why they still hold. Never change an RLS policy as a side effect of a feature task.

**Report only what you verified in this turn.** Never describe the prior state of code or database from memory or from earlier in the conversation — re-read it. Say exactly what you changed, even when it differs from what was asked.

## 14. Path D — External adviser (added 12 Sep 2026, people-and-access Batch 2)

Storage: `public.firm_viewer_access` — one row per person per organisation (`unique (firm_id, user_id)`), carrying the granted `dashboard_tier`, optional display-only inviter label, who granted it and timestamps. In user-facing copy this is an **External adviser — All clients** grant. RLS on; management is `app_private.can_manage_client_viewers(auth.uid(), firm_id)` = that organisation's **owner** (`is_org_owner`) **or** `app_private.is_practice_member_of` — an **active `firm_members` row for THAT organisation** held by someone in `public.practice_team`. A bare super admin, and a practice-team member of a different organisation, are both refused, so this is not a route back into a handed-over organisation (backlog 30 unaffected). The holder may read their own row.

Read path: `app_private.has_standing_client_access(user, client)` resolves the client's organisation and looks for a grant row; `app_private.has_client_read_access` = specific grant `OR` standing grant. `app_private.user_can_read_client` calls `has_client_read_access` in place of `has_client_access` — the only change to the client read check — and every viewer **SELECT** policy now names `has_client_read_access` (`clients`, `client_notes`, `client_cost_classifications`, `client_statutory_accounts`, `client_true_breakeven_inputs`, `client_xero_orgs`, `client_reports`, `loan_consolidation_accounts`, `reconciliation_snapshots`, `unreconciled_lines`, `unreconciled_uploads`, `tier_widget_config`).

Read-only, structurally: as of Batch 3 (13 Sep 2026) no viewer predicate appears in any write position at all. The three `scenario_exclusions` per-command write policies were dropped, the `unreconciled_lines` comment UPDATE policy now names `app_private.user_can_write_client`, and `public.user_can_write_client_scenario` returns `user_can_write_client` only. `user_can_write_client` and `user_can_manage_client` do not reference the standing predicate. Static guard 8 (`tests/static-guards.test.ts`, run by `bun run security:check`) reads the generated catalogue copy and fails the build if the standing predicate appears in any INSERT/UPDATE/DELETE policy, in any permissive `FOR ALL` policy, or in a write helper — and also fails if it stops being reachable from the read check.

Level: `app_private.viewer_tier(user, client)` returns the specific grant's tier when one exists, otherwise the standing tier, capped with `least()` by `public.client_entitlement(client).tier`. `public.client_access_tiers` now also returns the standing tier, so widget access follows the same rule. A grant can never widen access beyond the client's own tier.

Not membership: the holder gets no `firm_members` row, appears in no member list, counts toward no plan limit (`PLAN_LIMIT_CLIENTS` counts `clients` rows), and is denied `firms`, `firm_members`, `subscriptions`, `billing_events`, `client_subscriptions`, `access_invites` and `audit_log`. Matrix rows prove each of these, plus: a standing grant reads a client added after the grant; a specific grant overrides standing for that client; the entitlement caps the level; revoking a specific grant leaves the standing grant; a standing grant never crosses organisations; and only the owner manages grants (staff denied).

### 14.1 Viewer management and viewer invites (Batch 3, 12 Sep 2026)

Who may manage client viewers is one database predicate,
`app_private.can_manage_viewers_for_client` (via `can_manage_client_viewers`):
the client's organisation **owner**, or a `practice_team` person holding an
**active `firm_members` row for that same organisation**. It authorises
`grant_client_access`, `revoke_client_access`, `set_client_access_tier`,
`set_client_access_relationship`, `client_viewers`, `grant_firm_viewer_access`,
`revoke_firm_viewer_access`, `firm_viewers`, `firm_viewer_invites` and
`revoke_viewer_invite`. Direct browser-session writes to `client_access` are now
closed: `authenticated` has SELECT only, and no INSERT/UPDATE/DELETE policy.
Organisation **staff** may read the viewer lists and change nothing. Every grant,
classification and revocation goes through an aal2, caller-scoped, audited function.

Viewer invites reuse `access_invites` (hashed token, email-bound, single-use,
expiring) with `kind = 'viewer'`, `scope`, `tier` and `client_ids`. Every member
path filters `kind = 'member'`, so a viewer invite can never produce a
`firm_members` row. Acceptance runs `public.apply_viewer_invite`
(service_role only, called from the pre-session accept handler): it locks the
invite, re-validates the client ids against the organisation — skipping any
client deleted or moved, and failing with `VIEWER_INVITE_NO_CLIENTS` and no
acceptance stamp if none survive — then writes the `client_viewer` role, the
standing row or the specific rows, the acceptance stamp and the audit row in one
transaction. The user id is the auth user matched to the email-bound invite,
never a request value.

"Adjustable per client afterwards" is a specific `client_access` grant that
overrides the standing one; there is no exclusion row type.

### 14.2 The practice team and the one deliberate widening (Batch 5, 12 Sep 2026)

`public.practice_team` names Traction Advisory's own people. It is platform
metadata (Path C): RLS on, aal2 restrictive guard, readable by platform admins
only, no `anon` privileges, and writable only through
`public.admin_add_practice_member` / `admin_remove_practice_member` — both aal2,
super-admin-guarded, audited, with EXECUTE revoked from `PUBLIC` and `anon`.
`public.admin_practice_team()` lists it. The table confers no access by itself:
every path that consults it also requires an **active `firm_members` row for the
organisation in question** (`app_private.is_practice_member_of`), so a
practice-team person has nothing in an organisation they are not a member of.

`public.organisation_members` returns `is_practice` so the screens can badge
those people; the badge reflects membership, never the `super_admin` role.

**The widening.** `inviteClientViewer` previously required the `advisor` role.
It now reads no role and asks `public.me_can_manage_client_viewers(client)`
instead, so an organisation **owner** may invite, re-level and revoke client
viewers for clients **in their own organisation, and nowhere else**. Staff,
support-grant holders (PK 5), a super admin who is neither a member nor practice
team (PK 3), another organisation's owner (PK 4) and every aal1 session remain
denied. Inviting **team members** stays super-admin only.

**Organisation creation.** `adminCreateOrganisation` adds each practice-team
person as an active `staff` member inside its existing all-or-nothing block, one
audit row each. An empty practice team is normal: creation succeeds with the
creator as owner and only member. `public.admin_set_self_firm_membership` and its
handed-over restriction are unchanged — joining still requires the
organisation's owner to hold `super_admin`, so a practice-team person cannot
join a handed-over organisation.

### 14.3 External adviser and Business owner relationship foundation (13 Sep 2026)

Project Knowledge section 2 now names Path D **External adviser** and adds Path E **Business owner**, with invariant 11 forbidding a read predicate (`has_client_access`, `has_client_read_access`, `has_standing_client_access`) in any write policy, write helper or billing authorisation.

- User-facing copy says **External adviser**, with **All clients** or the number of selected clients. "Standing grant" / "standing viewer grant" are retired from screens. Internal names — `firm_viewer_access`, `client_access`, `has_standing_client_access`, matrix role keys, audit actions — are unchanged, and must stay unchanged.
- A `client_access` row and selected-client viewer invite now carry a nullable `relationship` (`business_owner` | `external_adviser`); `NULL` displays as **Not set** and is read-only. Existing rows were not inferred or backfilled. Relationship does not yet authorise a write or billing action.
- **Business owner** is reserved for self-service on one specific client only, never on an All clients grant. A client may have **several** business owners (partners, spouses), so there is no unique constraint on `(client_id)` for that relationship.
- **Membership governs an overlap.** After handover a person may hold both an active `firm_members` row and a `business_owner` row; membership is the broader path and the self-service capabilities are a subset of it, so the two cannot conflict. If the membership is later removed or suspended the relationship row is untouched, and the person falls back to self-service on that one client.
- Relationship changes go only through `public.set_client_access_relationship`, an aal2, caller-scoped, audited database function callable by the organisation owner or an active practice-team member of that organisation. Direct `client_access` writes are closed unconditionally: authenticated INSERT/UPDATE/DELETE privileges and policies were removed.
- Optional inviter labels are trimmed, 1–80 characters, and cannot look like email addresses. They are display-only. The verified sign-in email remains the identity; no label participates in an access decision.
- The invitation screen asks relationship first, then scope. Business owner is selected-client only. External adviser may be selected-client or All clients. New External adviser grants store the existing `multi_company` pass-through tier, but `client_entitlement` remains the authoritative cap.

This is the relationship foundation only. Business-owner self-service is not enabled.

**Batch 3 closed 13 Sep 2026 — the accidental External adviser writes are gone.** The three permissive `scenario_exclusions` write policies (insert, update, delete) that named `app_private.has_client_access` were dropped; scenario exclusions are written only through the audited server functions, which authorise with `public.user_can_write_client_scenario`, now `app_private.user_can_write_client` alone (aal2 gate unchanged). On `unreconciled_lines` the viewer comment UPDATE policy was replaced by "Members update comments for their client", using `app_private.user_can_write_client`. `enforce_unreconciled_line_viewer_columns` is kept and still restricts a non-advisor writer to `client_comment`; verified live 13 Sep 2026 by reading `pg_trigger` (trigger `unreconciled_lines_viewer_column_guard`, BEFORE UPDATE, enabled) and the function body, which raises unless only `client_comment` changed. Static guard 11 now fails the build if `has_client_access`, `has_client_read_access` or `has_standing_client_access` returns to any write policy, write helper or billing helper. **Regression fixed the same day.** Dropping the three `scenario_exclusions` write policies left the table with no write policy at all, so once user-initiated work runs through the caller's session no member or client owner could exclude or restore an invoice. The fix re-created them per command (`Members manage scenario exclusions (insert|update|delete)`, `to authenticated`, `app_private.user_can_write_client(auth.uid(), client_id)`) and added `Members read scenario exclusions` on the same predicate, because the only SELECT policy named the read predicate `has_client_access`. The three scenario server functions now write through `context.supabase` instead of the admin client, after the same `public.user_can_write_client_scenario` check. External advisers, All-clients advisers, unclassified `client_access` rows and support grants stay denied on all four commands. The matrix now asserts the positive case: member and client-owner read plus insert/update/delete on `scenario_exclusions` (8 rows that previously asserted deny), which is why the capability could disappear with the suite green.

## 15. Member removal (12 Sep 2026)

There is exactly one removal path: `public.remove_firm_member(_firm_id, _user_id)`
— aal2-guarded, `SET search_path`, EXECUTE revoked from `PUBLIC`/`anon`, caller
is always `auth.uid()` (the parameter is the target, never a claimed identity),
target row locked `for update`.

Removal is a **soft** removal: it sets `firm_members.status = 'removed'`, the
same shape `transfer_organisation_ownership` already uses. Nothing is deleted.

Who may do it:

- an **owner** may remove any `staff` member of their **own** organisation,
  including one of Traction Advisory's people (the handover case);
- **anyone** may remove themselves, unless they are the owner — an owner is
  refused with `OWNER_MUST_TRANSFER` and pointed at ownership transfer;
- **staff** may remove nobody. A support grant is not a membership, so PK 5 is
  untouched: it never reaches this write. The `super_admin` role alone gives
  nothing (PK 3), and another organisation's owner nothing (PK 4);
- no path removes an owner, and removal is refused (`LAST_MEMBER`) when the
  target is the only active member, so an organisation is never stranded.

One `audit_log` row `firm_member_removed` records actor, target, previous role,
previous status, organisation and whether it was a self-removal.

Removal touches nothing else: no `client_access` row, no `firm_viewer_access`
row, no Xero connection, snapshot or history row, and no account. A matrix row
counts those tables before and after to prove it.

Removed means removed, and this was verified rather than assumed: every
membership test is active-only — `app_private.has_firm_access`,
`app_private.is_practice_member_of`, `public.organisation_members`,
`public.my_firm_ids`, `public.my_firm_memberships` and `public.firm_access_path`
(through `has_firm_access`). `public.plan_level_usage_count` counts subscriptions
and `client_access` rows, never members, so removal cannot change a plan limit.

## 16. The slim live smoke suite

`bun run security:check` proves the whole access matrix against a faithful copy
of the live catalogue. The live suite exists for the only two things that copy
cannot produce: a **real session** — in particular the same person on `aal2` and
on `aal1` — and the **real server functions** over HTTP. It is a smoke test, not
a second matrix, and it keeps no expectations of its own: every probe reads its
expected allow/deny from `docs/security/access-matrix.ts` by
(role, resource, operation), and a probe with no matrix row is an error.

### What it exercises

Real sessions for three accounts (owner aal2, the **same owner on aal1**, staff
aal2, client viewer with a standing grant aal2) plus anonymous, calling
`listClients`, `getClient`, `renameClient`, `inviteClientViewer`,
`revokeClientAccess`, `removeOrganisationMember` and one Path C call
(`listFirmMemberInvites`). None of the accounts holds `super_admin` or a
`practice_team` row.

### Containment (each enforced in the database, never by convention)

- `firms.is_test` marks the one isolated organisation, `ZZ Security Test Org`.
  It has no Xero connection, so **no Xero API call is reachable** from the suite.
- `app_private.confine_security_test_accounts()` is a trigger on `firm_members`,
  `client_access`, `firm_viewer_access`, `firm_support_access`, `user_roles`,
  `practice_team` and `firms`. It refuses to attach a test identity to anything
  outside the test organisation, and refuses a platform role or practice-team row
  outright — **including for `service_role`**. The suite proves this by trying it
  as `service_role` and being refused.
- The accounts are **banned whenever a run is not in progress**. The runner
  sweeps and re-bans at the start, unbans for the run, and re-bans, signs every
  session out and restores the fixture in a `finally` block.
- Their addresses are permanently suppressed, and they are excluded from
  `admin_firm_overview`, `online_users()` and the posture people/MFA counts.
- Credentials and TOTP secrets are generated server-side and stored encrypted
  with `TOKEN_ENC_KEY` in `public.security_test_accounts`, a table with policies
  naming `service_role` only and no `anon` or `authenticated` privilege at all.
  TOTP codes are computed at run time; nothing is ever returned to a browser.

### Posture and triggering

`public.test_accounts_posture()` (aal2 + super admin) reports **Action** if any
test account can sign in outside a run, holds any membership, grant or role
outside the test organisation, or has a session outside the run window.
Two entry points, both authorised: the super-admin "Run access tests" button on
`/admin/security` (`assertSuperAdminDb`), and
`POST /api/public/security/run-access-tests`, which compares the single
owner-added `SECURITY_TEST_TRIGGER_SECRET` in constant time and is rate limited
to six trigger attempts per app-wide, fixed UTC-aligned 3,600-second bucket
before doing any work. This is the application's own global trigger bucket, not
an Auth sign-in or per-IP limit. The runner opens four password sessions in a
normal run (owner aal2, the same owner at aal1, staff aal2 and viewer aal2), or
seven only during first-time TOTP enrolment, and reuses those sessions across
all probes. Sign-ins are serialised and spaced one second apart; a database
claim prevents overlapping runs across server instances.

Supabase documents the default password/sign-in-related Auth allowance as 30
requests per five minutes per IP, with burst capacity up to 30; the token
endpoint default is 150 per five minutes per IP, also with burst capacity up to
30. These are documented provider defaults, not a claim that this project's
dashboard settings override them. A normal four-sign-in run uses 13% of the
documented sign-in allowance; first-time setup uses 23%. Provider sign-in and
MFA 429s, server-function 429s, an active-run collision and the trigger's own
429 all produce **INCONCLUSIVE — run did not complete**. They are never counted
as a pass or an access denial. Results land in
`public.security_test_runs` with layer `live`.

## 17. Attestations — controls no system can read (12 Sep 2026)

Some controls have no server-readable source. Leaked-password protection (Have
I Been Pwned) in the auth provider is one: the application cannot query it, so
its posture check would sit on Warn forever. A permanent amber that can never
go green trains people to ignore the card, so the honest evidence is a recorded
human confirmation — which is what an assessor expects for such a control.

- `public.security_attestations` — one row per attestable check
  (`check_key` PK, `confirmed_by`, `confirmed_at`, optional `note` ≤ 500 chars,
  `expires_after_days` default 180). RLS on; `anon` and `authenticated`
  defaults revoked; a single permissive `authenticated` SELECT policy requiring
  `app_private.me_is_super_admin()`; a RESTRICTIVE `mfa_aal2_required` guard;
  **no write policy of any kind**; audited by `public.audit_table_change`.
- `public.record_security_attestation(_check_key, _note)` — the only writer.
  aal2 + super admin, `SET search_path`, execute revoked from `PUBLIC`/`anon`.
  It stamps `auth.uid()` and `now()` itself; the caller can supply neither an
  identity nor a time. Writes `audit_log` action
  `security_attestation_recorded` (check key and whether a note was given —
  never the note text).
- `public.security_attestations_list()` — aal2 + super admin read, joined to
  `auth.users` for the confirmer's sign-in address (rule 10: identity comes
  from `auth.users`, never `profiles`).
- The attestable set is a **fixed allow-list in two places** — `attestable` in
  the function and `ATTESTABLE_CHECKS` in `src/lib/security-posture.functions.ts`.
  It currently contains `leaked_password` only. An attestation may **never**
  answer a check the server can read for itself; adding a key to that list is a
  security-relevant change requiring the owner's approval.
- Posture behaviour for an attestable check: **OK** with a current attestation
  (evidence states in terms an assessor cannot misread that this is a recorded
  human confirmation, not a machine reading, and names who and when);
  **Warn — "confirmed on <date>, needs re-confirming"** past
  `expires_after_days`; **Warn — "not verified"** with none.
- No access path, role or organisation-scoped rule is touched: this is platform
  metadata (Path C), and it holds no organisation or client data.

## 20. Dashboard cards — one rule, one switch (Batch 4, 15 September 2026)

Two card models exist in the database, selected by
`app_private.platform_settings.card_model_v2` (currently `false`). One of them
decides, never both.

**v2 — the organisation's purchase decides which cards exist.** Inputs, in
order: aal2; can this person read this client
(`app_private.user_can_read_client`); the organisation's purchase row
(`public.org_subscription_options` — Advisory on/off, Consolidation on/off,
Consolidation also requiring more than one client in the organisation); the
lapsed-organisation check (`app_private.firm_subscription_lapsed`, billing state,
not entitlement); and the client's single ticked list (`public.client_cards`,
no stored row meaning all available). The one implementation is
`app_private.client_cards_v2`, used by `public.client_visible_cards`,
`public.client_allowed_widgets`, `public.assert_widget_access` and
`public.firm_allowed_widgets`. Nothing in this path reads
`public.client_entitlement`, `client_subscriptions.tier`, `plan_levels` or
`tier_widget_config`. `client_entitlement` keeps plan limits and billing display
only.

An external adviser's own `client_access.tier` does not narrow cards
(owner decision, 15 September 2026, matching the removal of the Dashboard level
from the External adviser invite): an adviser sees what the client sees, capped
by the purchase, and read-only — read-only is enforced by the write policies and
write helpers, never by the card list.

**v1 — legacy, retiring.** `client_entitlement` gives a dashboard tier, the
ceiling is `plan_levels.widgets` for that tier, and the organisation row of
`tier_widget_config` (replacing the platform row, not unioned) plus the client's
own row are subtracted; the dashboard gate separately derived cards from
`client_access.tier` through `app_private.effective_widgets_for_client`.

`src/lib/widget-resolve.server.ts` is a known invariant 6 violation kept for the
legacy model and the old configuration screens. Under v2 it only forwards to the
database (`public.card_model_active`, `public.client_visible_cards`,
`public.client_available_cards`); it never re-derives the new rule.

Proof with the switch on, run inside a transaction that always rolls back:
`scripts/card-model-v2-proof.sql`.
