# Daily forced re-sign-in after 3am + missing logout

**Classification: SECURITY-RELEVANT** — touches auth/session enforcement (invariant 2, server-side). Decisions locked in: 3am **Australia/Sydney** (AEST/AEDT), **full sign-out, server-enforced**.

## What you'll get

- Everyone must sign in fresh once per day: any session created before the most recent 3am (Sydney time) is rejected, so after 3am the next action signs the person out and sends them to the sign-in page. Because MFA is already mandatory, each daily sign-in also requires the authenticator code — no extra change needed.
- A Sign out option on every signed-in screen, including the admin menu and settings pages that currently have none.

## Steps

1. **Server-enforced session cut-off (database layer).** Extend `app_private.assert_aal2()` — the check every protected policy and definer function already calls — to also require the session's issued-at time to be after the most recent 3am `Australia/Sydney` (computed via `timezone('Australia/Sydney', now())`). Stale sessions are denied exactly like a missing MFA: generic error, no data returned. Service-role/system contexts (webhooks, cron, email queue) are unaffected.
2. **Server-enforced cut-off (application layer).** Add a project middleware in `src/start.ts` that, when a request carries a sign-in token, rejects sessions issued before the most recent 3am Sydney with a generic 401. This covers any server function that doesn't hit the database check.
3. **Sign-out + redirect in the browser.** The signed-in layout gate (`_authenticated/route.tsx`) checks the session age on every navigation; if stale it signs out and redirects to `/auth` with a clear "please sign in again — daily sign-in required" message.
4. **Missing logout option.** Add a Sign out button to the admin navigation shell (`AdminNavShell`), and review the remaining signed-in pages without any sign-out affordance (settings pages, client setup, organisation pages); render the standard app header with Sign out where a page currently has no way out.
5. **Docs + evidence.** Update `docs/security/access-control-spec.md` and `docs/security-backlog.md` (daily session cut-off rule), add matrix rows (stale session denied at DB and server layers), run `bun run security:check` and the Supabase linter, and produce the Security report.

## Technical details

- Cut-off formula: `timezone('Australia/Sydney', now())::date + interval '3 hours'` converted back to UTC — handles AEST/AEDT automatically.
- JWT `iat` claim is the session-issued timestamp used at both layers; the browser check reads the same value from the stored session.
- `app_private.assert_aal2` keeps `SET search_path`, stays caller-scoped, no new roles or access paths — it only narrows when an already-authorised session is valid.
- Auto-generated auth files are not edited; enforcement lives in project-owned code that wraps them.

## Not in scope

- No change to MFA enrolment/verify flow, session length limits in auth settings, or idle timeouts (can be added later if wanted).
