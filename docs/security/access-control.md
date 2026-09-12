# Access control — assessor-facing summary

> **What this file is for.** The plain-English summary an assessor or a new reader starts with. It
> ties the other documents together and states no rule of its own.
>
> **Which document wins.** Project Knowledge ("Security Rules and Change Gate") is BINDING and wins
> over everything here. `access-control-spec.md` holds the detail. `access-matrix.ts` (and the
> generated `access-matrix.md`) is the EVIDENCE — where a document and the matrix disagree, the
> matrix is right, because it is proved against the live catalogue on every run of
> `bun run security:check`. This file is a summary and never authoritative.

Verified against the live system on 12 September 2026 (Phase 7 batch 3).

## Authentication

- Self-signup is disabled. Sign-in is email/password or Google OAuth; people are invited.
- TOTP MFA is mandatory, and **enforced on the server** in three layers. The browser gate
  (`MfaGate`, the `_authenticated` layout) is UX only and is never relied on:
  - **Server functions.** `requireAal2` (`src/lib/auth/require-aal2.ts`) rejects any session whose
    token claim `aal` is not `aal2`. It guards every authenticated server function bar two logging
    exceptions, `logAuthEvent` and `logLogin`, which record the sign-in and MFA lifecycle itself
    before a second factor can exist. Both are write-only, take actor and email from the verified
    token, accept no caller free text (a six-value allow-list; `logLogin` takes no input) and are
    rate limited through `public.check_rate_limit`. Seven server functions are deliberately
    unauthenticated (Xero sign-in start/callback, the public report link, webhooks and cron
    routes); each verifies its own credential.
  - **Database.** A RESTRICTIVE `FOR ALL TO authenticated` policy named `mfa_aal2_required`
    (using `app_private.is_aal2()`) sits on **51 of the 53 `public` tables**. The two exclusions are
    owner-approved: `plan_levels` and `tier_settings`, the plan/tier catalogue, which hold no
    organisation, client or personal data. RLS is enabled on all 53 tables.
  - **Callable functions.** Every SECURITY DEFINER function callable by a signed-in user asserts
    aal2 in its body, with one approved exception (`public.xero_required_scopes()`, a fixed
    constant list). See the generated `definer-register.md`.
  - `app_private` is not an exposed PostgREST schema, so its helpers cannot be called from a browser.
- Leaked-password (HIBP) checking is enabled.

## Authorisation — one rulebook

Access decisions live in the database and nowhere else (Project Knowledge invariant 6). Server code
calls a caller-scoped database function; it never re-implements a rule in TypeScript. The build
enforces this: `tests/static-guards.test.ts` fails on a direct read of `user_roles`,
`firm_members`, `client_access` or `firm_support_access` in a converted file, on a `supabaseAdmin`
call that is not preceded by a registered database authorisation call, and on any read of
`profiles.email` (identity always comes from `auth.users`). Every `supabaseAdmin` use is listed with
a verified reason in `admin-client-register.md`.

There are exactly three access paths, and they are never collapsed:

- **Path A — membership.** An active `firm_members` row: read and write within that organisation.
- **Path B — support grant.** Only for an organisation Positive Traction is not a member of.
  **Read-only everywhere**, one named person, maximum 72 hours, approved by that organisation's
  owner, and a super admin may never approve their own. A support grant reads the client list and
  statutory accounts as well as the dashboards; it writes nothing at all, including branding.
- **Path C — platform operations.** Metadata only: organisation list, plans, billing events, signup
  requests, invites, audit log, roles, `xero_api_errors`, security posture. Never Xero financial data.

**Being `super_admin` grants zero access to organisation or client data on its own.** Bounded and
audited: a super admin may join or leave only organisations Positive Traction still owns
(`admin_set_self_firm_membership`); ownership changes only through
`public.transfer_organisation_ownership`; `is_always_free` can be set only on Positive Traction's own
organisation, fails closed if that organisation cannot be identified, and requires a 3–500 character
reason. Each of these writes its own audit row.

Client viewers hold a `client_access` row for one client at a granted tier. They read only that
client, at that tier, and the matrix proves they cannot write the client record or their own access
row.

## Reads of client financial data are audited

Every path that shows a person a client's figures writes an audit row through one server-side
helper (`src/lib/audit.server.ts`):

- Actions: `xero_data_read` for Xero figures (live, stored snapshot or cache) and
  `client_report_read` for a stored report or a public report link.
- Sources: `live`, `snapshot`, `cache`, `report`, `report_link`.
- Each row records who read it (or that there was no signed-in person, for a report link), which
  client, which Xero file, a short stable key for what kind of figures (`pnl`, `receivables`,
  `report:monthly`), the period or date range where one applies, and the access path.
- Rows **never** contain figures, account names, contact names, tokens, IP addresses or device
  details, and never the report-link token.
- Reads are grouped: one row per person, client, Xero file, key and source per five minutes, so a
  dashboard page view does not flood the trail. A different person or a different client always
  produces its own row.
- A failed audit write is swallowed and logged, exactly as telemetry is: it never breaks a dashboard.
- Coverage is checked by `public.read_audit_posture()` on the Security card, and by static guard 7,
  which fails the build if a read path stops calling the helper or writes a read action directly.

## Grants

`authenticated` holds only the privileges the policies on that table actually admit (Phase 7 batch 1;
before/after dump in `grant-dump-phase7.md`). No app role holds TRUNCATE, REFERENCES or TRIGGER on any
table; `anon` holds nothing; token columns of `xero_connections` have no grant to any app role, only
the 13 non-token columns do.

## Xero connection lifecycle

- A connection always belongs to an organisation (`xero_connections.firm_id` is `NOT NULL`), and a
  Xero file the plan has no room for, or that no organisation can be resolved for, is **refused and
  not stored** (audited as `xero_file_refused`).
- Disconnection revokes at Xero **first** (`DELETE /connections/{connectionId}`), verifies the
  connection is gone, and **fails closed**: if Xero does not confirm, nothing is marked and the
  person is told. It then **marks** the row `disconnected` rather than deleting it, and **keeps the
  client-to-Xero-file link** so a reconnect restores the same file to the same client.
- Both outcomes are audited (`xero_disconnected`, and the failure path). A disconnected connection
  does not count toward the plan's Xero file allowance.
- Tokens are stored encrypted (AES-256-GCM, `TOKEN_ENC_KEY`, server-only) and never leave the server.
  Refresh tokens rotate and are stored atomically under a row lock. On 401/403 the connection is
  marked disconnected — no retry loops.

## Audit log — who may read it

**An organisation may NOT read its own audit log.** This is a deliberate decision (see
`access-control-spec.md` §9), not an oversight: `audit_log` is a single platform-operations trail
across all organisations, so only Positive Traction super admins may read it.

## Account lifecycle

- Invites are email-bound, single-use and expiring, and store a token hash only. Team member and
  client viewer invitations are issued from the organisation's People screen.
- Password resets go through Supabase Auth with the HIBP check.
- Super admins can reset a person's MFA factors from Admin → Security; the action is audited.
