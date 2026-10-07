# Client overview (practice-team landing page)

Five batches, run in order. Each batch is classified first and must pass the full Security Gate (section 3) before the next one starts: `bun run security:check` with the known-failure list unchanged, `security_posture()` and the linter showing nothing new, a Security report, and a backlog update. No batch adds an access path, role or exception. The page only shows rows the caller can already read.

## Decisions needed from you
1. **Who counts as practice team on the database side.** Landing and the sidebar link are decided by a caller-scoped function, `me_is_practice_member()`. It returns true only when the caller has a `practice_team` row AND at least one active `firm_members` row. This is routing only. Do you agree that a `practice_team` person with no active membership lands where they do today?
2. **DECIDED (owner): acknowledge/snooze is SHARED.** State keyed by client_id + event_key, with acknowledged_by/snoozed_by and timestamps shown in the feed. Writes only through one audited aal2 caller-scoped definer function that requires `user_can_write_client(client_id)`. SELECT uses the existing client read predicate. Authenticated users get no direct table writes. An item re-shows when its severity rises above severity_at_ack or the snooze ends. Un-acknowledge is supported. Matrix rows for every persona.
3. **"Report not sent by the usual point".** I propose: no `client_reports` row with `sent_at` for the previous month by the 15th business day of the current month. One threshold, kept in the thresholds object. Please confirm or give me the day.
4. **Organisation trials and lapsed state.** If Batch 0 finds that a no-charge organisation shows lapsed notices or is skipped by the nightly refresh, I will stop and bring you the smallest fix. I will not apply it inside Batch 0.

## Batch 0 — Read-only checks (no edits)
**Classification:** security-relevant (billing, entitlement, Xero refresh). Read-only, so no gate edits; I report findings only.
- a) Trace how `snapshot-refresh.server.ts`, the `/api/public/xero/snapshot-refresh` route and `claim_xero_snapshot_run` pick clients. Look for any filter on purchase, Billing mode, subscription status, lapsed state or `is_always_free`. Check this against live data for a sample organisation with no options. If clients would be skipped, propose the smallest fix: for example, refresh is driven by an active Xero link rather than by entitlement. Never `is_always_free` on a client organisation.
- b) Read `firm_subscription_state`, `subscription-state.server.ts`, `org_subscription_options.billing_mode` and the UI that shows lapsed notices. Report the exact behaviour for "Billing off, no options".
- c) Query the definitions and jobs that prune `xero_snapshots`. Report how long rows are actually kept, and the retention (13+ months of daily rows) needed for year-on-year comparison. Report the storage implication. No change.
- d) Read the live organisation-creation function and confirm practice-team members are added as active members. Check the most recent organisation against live rows.

## Batch 1 — Overview page, computed on read
**Classification:** security-relevant (reads client Xero figures, adds a server function and a route, routing based on role).
**Invariants:** 1, 2, 3, 4, 6, 8, 9, 10; Path A only (B, D and E callers see nothing new because the server function calls a staff predicate).
**Threats:** cross-organisation leak through caller-supplied IDs; super admin seeing data without membership; a viewer or business owner reaching staff-only verdicts; landing logic becoming a grant; too many fields returned; read audit skipped.
**Build:**
- `src/lib/overview/thresholds.ts`: one exported object holding the big-move rule (25%, max($10,000, 10% of average monthly revenue), 1-day and 7-day windows, prior-month comparison, the report-not-sent day).
- `src/lib/overview/overview.functions.ts`: `getClientOverview` with `requireAal2` and Zod (no IDs accepted, only an optional search string). The client list comes from a new caller-scoped definer function, `overview_clients()`. It covers clients where the caller is an active organisation member (Path A), returns only id, name, organisation id and organisation name, and is aal2-guarded with `REVOKE EXECUTE` from `PUBLIC` and `anon`. Snapshots are read through `context.supabase` (existing RLS), and status comes from the existing `evaluateClient`. Figures come from `analyseBalanceSheet`, tax-lines and the existing debtor helpers. One read-audit call per client through the existing Phase 6 writer. Generic errors.
- `src/lib/overview/changes.server.ts`: pure functions comparing today, 1 day ago, 7 days ago and the same point last month. These run on whatever snapshot history exists, and the result says when history is too short for the "unusual" test.
- Route `src/routes/_authenticated/overview.tsx`: counts strip with filters, a table sorted worst first, group-by-organisation toggle, search. Status uses `ClientHealthBadge` wording. Stale, partial or disconnected data is never green.
- Landing: the post-sign-in destination checks `me_is_practice_member()`. Everyone else is unchanged. Sidebar "Overview" link shown under the same check.
**Database:** `overview_clients()` and `me_is_practice_member()` (definer register entries and purposes).
**Matrix rows:** `overview_clients` and `me_is_practice_member` for each persona (member, staff, owner, practice member with no membership, super admin only, support grantee, external adviser specific, external adviser all clients, business owner, anon, aal1). Expected result: members see only their own organisations' clients; everyone else gets an empty result or is refused.
**Tests:** thresholds and change-detection unit tests (25% boundary, $10,000 floor, 10%-of-revenue floor, history-too-short path).

## Batch 2 — "What changed — last 7 days" feed
**Classification:** security-relevant (same reads, more derived output).
**Invariants:** same as Batch 1. No new database objects.
**Threats:** the feed showing clients the table does not show; repeated alerts; extra Xero calls.
**Build:** extend `getClientOverview` (or add a sibling function over the same client set) to return events: escalations (`evaluateClient` on the snapshot set as at 7 days ago compared with now; only a worsening counts), big moves, data events (disconnected, run failed from `xero_snapshot_runs`, stale), and report not sent. Each event carries client, organisation, headline, before → after, date and a link. Still zero Xero calls.
**Note:** escalations need snapshots dated 7 days ago. If Batch 0 shows that current rows are overwritten rather than kept as history, the feed shows "not enough history" until Batch 3 data builds up.
**Tests:** escalation ordering (critical staying critical gives no event; ok to watch gives an event), plus the event rules.

## Batch 3 — Nightly key-figures table
**Classification:** security-relevant (new client-data table, new `supabaseAdmin` writer).
**Invariants:** 1, 2, 6, 7, 8, 11.
**Threats:** a broad policy; anon or authenticated default grants; a writer using a caller context; a write policy that uses a read predicate.
**Database:** `client_key_figures` (client_id, firm_id, tenant_id, as_at date, cash, debtors_total, debtors_overdue, creditors, protected_money, revenue_mtd, net_profit_mtd; unique per client, tenant and date). `revoke all from anon, authenticated`; grant SELECT to authenticated only; RESTRICTIVE aal2 guard; per-command SELECT policy `to authenticated` using the existing client read predicate. No insert, update or delete policies, so only the service role writes. Retention set only once you decide on Batch 0 c).
**Build:** the nightly refresh writes one row per client after a complete snapshot run, using the same extraction helpers. Register entry in `admin-client-register.md`. Sparkline on the overview, read with audit.
**Matrix rows:** `client_key_figures` select/insert/update/delete for every persona.

## Batch 4 — Acknowledge and snooze (per person, pending decision 2)
**Classification:** security-relevant (new writable table).
**Invariants:** 1, 2, 6, 11.
**Database:** `overview_alert_states` (user_id, client_id, event_key, severity_at_ack, acknowledged_at, snoozed_until). RLS and the aal2 guard are on. Each command gets its own policy `to authenticated`. Every policy requires `user_id = auth.uid()`. INSERT and UPDATE also require `user_can_write_client(client_id)`, the write predicate and never a read predicate. Writes go through one audited definer function. Matrix rows for every persona.
**Build:** the feed hides acknowledged or snoozed items. It shows an item again when its severity rises above `severity_at_ack` or the snooze ends.

## Technical notes
- Each batch updates `docs/security-backlog.md`, the access matrix, the definer register and `roadmap.md` in the same change.
- No composite score and no second verdict engine. UI copy says "organisation" and uses Australian English.
