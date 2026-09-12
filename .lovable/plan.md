# Phase 7 — tidy up and prove it

Classification: SECURITY-RELEVANT (grants, definer functions, documentation, full re-audit).
This phase removes privileges and surface. No new access path, no new role, nothing widened.

## What I verified live before writing this (12 Sep 2026)

- 53 tables in `public`; **RLS is on all 53**.
- **`anon` holds no privilege on any `public` table** — so the "anon holds anything" half of the `excess_grants` backlog item is already clean. Nothing to do there.
- `authenticated` holds **TRUNCATE on 47 of 53 tables**, and on most of those the full default set (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) — Supabase's default, never trimmed.
- Tables where `authenticated` holds INSERT/UPDATE/DELETE with **no permissive policy for any command**: `access_invites`, `billing_events`, `dashboard_configs`, `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `firm_members`, `rate_limit_buckets`, `report_cache`. Writes there are already refused by RLS, so the grants are pure surface.
- 96 SECURITY DEFINER functions in `public`, 31 in `app_private`. Every `public` definer executable by `authenticated` that I sampled has `SET search_path` and contains `assert_aal2` — Phase 1 held.
- Function-level `EXECUTE` is `authenticated` + `service_role`; `anon` on none of the sampled set.
- Not called anywhere in app code, tests or scripts: `public.firm_has_consolidation`, `public.record_access_test_run` (belongs to the parked live suite), and the `report_cache` table.

## Batch 1 — trim table grants to what the policies need (one migration)

One migration, not batched: a per-table `REVOKE ALL … FROM authenticated` followed by narrow re-grants is only safe if it is atomic. Half-applied grants are exactly the fail-open state to avoid, and the whole change is a single transaction.

Rule applied per table, derived from the policies that exist — not a blanket rule:

1. `REVOKE ALL ON public.<t> FROM anon, authenticated;`
2. `GRANT SELECT` back only where a permissive SELECT (or `FOR ALL`) policy for `authenticated` exists.
3. `GRANT INSERT / UPDATE / DELETE` back only per command that has a matching permissive policy.
4. `GRANT ALL … TO service_role` preserved everywhere (system contexts already depend on it).
5. TRUNCATE, REFERENCES, TRIGGER, MAINTAIN granted to nobody.
6. `profiles` keeps its existing column grant shape (`UPDATE(display_name)` only).

What could break, and the proof: any screen quietly relying on a grant that RLS would have allowed but no policy names, plus definer functions that read as their owner (unaffected — owner is `postgres`). Proof is the access matrix: `bun run security:check` before and after with the fixture fingerprint, the matrix rows re-proved, and a full before/after grant dump committed to `docs/security/grant-dump-phase7.md` so the change is reviewable line by line. Any matrix row that changes result stops the batch.

Owner test: sign in as a member, open a client dashboard, add and edit a note, edit statutory accounts and cost classifications, save break-even inputs, invite a member, revoke a viewer, generate and send a report; then as a client viewer, open the dashboard and confirm read-only still reads.

Estimate: medium-large (the migration is generated, the verification is the work).

## Batch 2 — definer sprawl: remove only what is provably dead

- Produce the complete callable-definer table (name, args, purpose, callers) into `docs/security/definer-register.md`, generated from the database plus a code search so it cannot drift silently.
- Propose removal of `public.firm_has_consolidation` and `public.record_access_test_run` **only after** proving each dead: zero references in `src`, `tests`, `scripts`, zero references from other function bodies, zero references from any policy, and zero calls in the PostgREST request logs for the retention window. If any check finds a caller, it stays and is recorded as live.
- `record_access_test_run` is the parked live suite's writer — removing it is tied to the Part 5 decision below. Recommendation: keep the function, drop nothing, if the slim smoke suite is approved.
- Duplication to merge, not collapse: `public.user_can_access_client` / `user_can_read_client` / `user_can_write_client` are genuinely distinct (read vs write vs legacy alias) — the legacy alias is the only merge candidate, and only if unused.
- No function that is still called is touched. Fewer is not the goal.

Estimate: small-medium.

## Batch 3 — documentation an assessor can be handed

`docs/security/access-control-spec.md` is dated 11 Sep 2026 and its section 12 still describes the backlog state before Phases 3–6. `docs/security/access-control.md` (28 lines) predates Phases 3–6 entirely: it describes roles and RLS but nothing about read auditing, support grants being read-only, the disconnect/revocation position, or the Phase 4 single-rulebook helpers.

Corrections to make, each traced to the phase that changed it:

| Statement today | Correction |
|---|---|
| `access-control.md` "policies scope reads to firm members or `auth.uid()`" | name the `app_private` helpers and the read/write split (Phase 3a) |
| no mention of support grants being read-only | add it, with the write-side helpers that refuse them |
| audit section covers security events only | add the read audit: `xero_data_read` and `client_report_read`, sources `live`/`snapshot`/`cache`/`report`/`report_link`, no figures recorded (Phase 6) |
| nothing on disconnection | revoke-first, fail-closed, mark-not-delete, link retained, audited (Phase 5) |
| spec §12 backlog pointer | re-point at the current backlog state |

Files and their jobs, unchanged in principle: Project Knowledge = binding rules; `access-control-spec.md` = the detail; `access-matrix.ts` / `.md` = the evidence; `access-control.md` = the assessor-facing summary that ties the three together.

Also list (not answer) what the Xero assessment response needs and where each answer comes from: MFA position, the three access paths, support grants read-only, audit position, token handling and encryption, disconnection and revocation, retention and purge, incident response, dependency and vulnerability management.

Estimate: small. Docs only, no code.

## Batch 4 — full re-audit from scratch

Run the original audit as if today were day one, against the live database and current code, assuming nothing from Phases 1–6: every table (RLS, policies per command, table and column grants), every definer function (guard, `search_path`, execute grants), every server function (aal2 and authorisation before privileged work), every public route and its credential, secrets, tokens, storage buckets, cron jobs, and the Supabase linter with each accepted finding and its reason.

Output is a findings list only. Anything found becomes a **new numbered backlog item** in `docs/security-backlog.md`. If nothing is found, the report says so plainly.

Estimate: medium. No behaviour change in this batch by design.

## Part 5 — what remains

- **Open owner decision A — may an organisation read its own audit log?** Recommendation: yes for its own rows, read-only, excluding platform-operations rows, as a later phase. Not in Phase 7.
- **Open owner decision B — the super admin with no verified MFA factor.** Recommendation: enrol or demote this week; server enforcement already blocks that account from all data, so the risk is an account that cannot work rather than an exposure.
- **Phase 2 part 3 (live smoke suite), parked after Phase 4.** Recommendation: still worth building, at reduced scope — one non-super-admin member, one client viewer, one outsider, in a single `ZZ` test organisation, asserting cross-organisation denial and aal1 denial only, with no Xero calls and no super-admin test account. Rationale: the access checks are now consolidated in the database, so the fast suite already proves the rules; the live suite's remaining value is proving the real token path, which nothing else covers.
- **Deliberately not done:** `FORCE ROW LEVEL SECURITY` (settled WON'T DO), token column exposure (settled CLOSED), the `setClientXeroAllowance` super-admin escalation (owner-decided exception), and the tier catalogue readability (assessed, left as-is).

## Owner decisions needed

1. Approve Batch 1 as one migration with the committed before/after grant dump. **Recommend yes.**
2. Approve removing `firm_has_consolidation` if proven dead; keep `record_access_test_run` pending decision 3. **Recommend yes.**
3. Approve the slim live smoke suite at the reduced scope above, after Phase 7. **Recommend yes.**
4. Decisions A and B above.
