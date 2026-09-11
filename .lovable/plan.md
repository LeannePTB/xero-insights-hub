# Phase 5 — Xero connection lifecycle (PLAN ONLY)

Classification: **SECURITY-RELEVANT** — Xero OAuth, tokens, `xero_connections`, `supabaseAdmin`, audit. Invariants touched: 4 (caller ids are filters), 5 (support grants read-only), 6 (one rulebook), 7 (admin client), 8 (no tokens in logs/meta), 9 (never loosen).

Nothing in this plan revokes, deletes or disconnects anything as a deployment side effect. No Xero call was made while planning.

## 1. Current state, verified 11 Sep 2026 (read-only)

Live data, one query, no writes: **12 connection rows, 12 distinct Xero files, 0 duplicate files, 0 rows without an organisation, 0 rows without a client link, 0 rows not `connected`, 5 disconnect audit rows, 5 "authorisation lost" audit rows.**

**Problem 1 — disconnect does not revoke at Xero: NO LONGER TRUE, but there is a different defect.**
`src/lib/xero/disconnect.server.ts` already looks Xero's own connection id up from `GET /connections`, sends `DELETE /connections/{id}`, then re-reads Xero's list and only reports success when the file has actually gone; a failure returns `failed` and `disconnectXero` (`src/lib/xero/connections.functions.ts:483-544`) writes a `xero_disconnect_failed` audit row and throws. That matches Xero's documented model, where a connection is removed by its connection id, not the tenant id [4](https://developer.xero.com/documentation/best-practices/managing-connections/connections/), [5](https://stackoverflow.com/questions/72002596/cannot-delete-a-connection-on-xero-api).
The real remaining defects in that function:
- it **hard-deletes** rows: `.delete().eq("tenant_id", …)` — every row for that Xero file, for every person and potentially another organisation's row, with no `firm_id` filter. A disconnect should mark one row disconnected, not delete rows.
- the pre-check uses `.maybeSingle()` on `tenant_id`, which errors as soon as two people hold the same file.
- authorisation is done in TypeScript (`userCanManageClient`, or `row.user_id === caller`) rather than through a database function — Phase 4 rulebook drift.

**Problem 2 — no detection when the client revokes: MOSTLY FIXED, one real gap.**
`src/lib/xero/authorised-tenants.server.ts` reconciles our rows against `GET /connections` nightly (via `snapshot-refresh.server.ts:361`), immediately after every callback, and lazily per screen with a database rate limit (`authorisation-freshness.server.ts`). It is fail-closed, writes `xero_authorisation_lost` / `xero_authorisation_restored`, and never deletes data. Gap: if the whole **token** is dead (client revoked the app, or the refresh token was rejected), `getConnection` throws, the user is counted as `usersSkipped`, and every row stays `connected` for ever. A definitive `invalid_grant` from Xero's token endpoint is indistinguishable from a timeout today.

**Problem 3 — reconnect overwrites other people's rows: STILL TRUE.**
`src/routes/api/public/xero/callback.ts:342-356` updates **every** row for the tenant (`.eq("tenant_id", …).or("firm_id.eq.X,firm_id.is.null")`) with the reconnecting person's tokens. No live duplicates exist, so nothing is wrong in the data today — the code permits it the moment two staff hold one file.

**Problem 4 — orphans keep coming back: CAUSE CONFIRMED, none live.**
`callback.ts:449-500` stores every tenant Xero returns. A row is left unstamped (`firm_id` null) when the tenant was already known, or when the plan-limit trigger refuses the stamped insert and the code retries without `firm_id`. That is the orphan factory; `OrphanXeroConnectionsCard` is the manual sweep. Unique index is `(user_id, tenant_id)` only — nothing prevents an unstamped row.

## 2. Xero facts to confirm before building (step 0 of the build)

Confirmed enough to design on: a connection is removed by `DELETE /connections/{connectionId}`, where the id comes from `GET /connections` and is **not** the tenant id [4](https://developer.xero.com/documentation/best-practices/managing-connections/connections/), [5](https://stackoverflow.com/questions/72002596/cannot-delete-a-connection-on-xero-api); revoking the **refresh token** at `https://identity.xero.com/connect/revocation` is account-wide and would drop every organisation on that login, so it stays unused [2](https://developer.xero.com/documentation/guides/oauth2/token-types); Xero publishes a connection cleanup guide we should follow rather than invent [3](https://developer.xero.com/documentation/best-practices/managing-connections/designing-and-implementing-connection-cleanup-routine).
To confirm by reading those pages before any code (no live calls needed): the exact success status of `DELETE /connections/{id}` (204 vs 200), and the exact error body Xero returns for a revoked grant on the token endpoint. If the second cannot be confirmed from documentation, we treat only the literal `invalid_grant` error code as definitive and everything else as transient — the safe direction.

## 3. Correct disconnect

Revoke first, verify with Xero's own list, then update **one** row:
- keep the existing revoke-and-verify helper unchanged;
- replace the hard delete with `status = 'disconnected'`, `disconnected_at = now()`, `disconnected_reason = 'disconnected_by_advisor'` on the **single row id** resolved server-side, scoped to that organisation;
- authorise through one new caller-scoped database function (`public.user_can_disconnect_xero_connection`) — aal2, `SET search_path`, revoked from `PUBLIC`/anon, membership or client-owner only, never a support grant;
- Xero unreachable or refusing: the user sees "Xero didn't confirm the disconnect — nothing has changed. Please try again." The row stays connected (no pending state, no retry queue), and a `xero_disconnect_failed` audit row is written with the status and reason only — never a token.
- data and snapshots are untouched by a disconnect.

## 4. Detecting revocation from the client's side

Keep all three existing triggers. One addition: when the token refresh fails with a definitive `invalid_grant`, mark that person's rows `disconnected` with reason `grant_revoked` and write `xero_authorisation_lost`; any other failure keeps today's leave-alone behaviour. The advisor sees the existing "Missing permissions / Reconnect" state on the client and organisation screens. No client data, snapshot or report is ever deleted — historical figures keep showing with their existing "as at" date.

## 5. One row per person per Xero file

- reconnect updates only `where tenant_id = … and user_id = <reconnecting person>` and the row must already belong to that organisation; other people's rows are left exactly as they are (they keep their own tokens and their own status);
- reads pick the connection deterministically: the row linked through `client_xero_orgs` first, then the most recently authorised `connected` row for that file within the organisation — never an arbitrary `.limit(1)`;
- **migration: 0 rows would change.** 12 rows, 12 distinct files, no duplicates. The migration is a no-op today and exists only so the rule holds later; it applies no data change at all.

## 6. Orphan prevention

Fix at the source: the connect/onboard callback stops storing tenants that were not asked for. Rows are only written for tenants in `pending_tenant_ids` for that flow; a tenant refused by the plan limit is reported to the user ("this organisation's plan has no room for another Xero file") instead of being stored unstamped. Then add a database constraint that a connection row must carry a `firm_id`, plus a check that `firm_id` matches the linked client's organisation. The orphan screen stays as a read-only view of legacy rows and can be retired once it reads zero.

## 7. Safety rules for this phase

- Deploying this phase performs **no** Xero call and **no** row change. The constraint is added only after a read-only count proves zero violating rows; if any exist, the constraint is deferred and reported, never forced.
- Any tidy-up of existing rows is a separate, super-admin-triggered screen action with **dry-run first**, listing exactly which rows and which Xero files it would touch, and requiring a second explicit confirmation.
- No destructive Xero call from a migration, a scheduled job, or app start. The nightly job stays read-only against Xero.
- Every disconnect, revocation detection and failure writes an audit row.
- `tenant_id` stays resolved server-side; no tokens or secrets in logs, URLs or audit meta; no `select *` on `xero_connections`; no new access path.

## 8. Rollout order

1. Documentation confirmation (§2) — no code. Owner reads the two answers.
2. Disconnect fix: mark-not-delete, single row, database authorisation. Owner tests: disconnect one Xero file on a test client, confirm Xero's own Connected Apps list no longer shows it, confirm the row reads disconnected and the client's history still displays.
3. Reconnect scoping to the reconnecting person. Owner tests: reconnect one file and the bulk reconnect; confirm both still work and nothing else changed.
4. `invalid_grant` detection. Owner tests: after a client disconnects the app inside Xero, the file shows disconnected within a day and no data disappears.
5. Orphan prevention in the connect path, then (owner confirms first) the database constraint.
6. Optional, owner-triggered only: dry-run tidy-up screen for legacy rows.
Steps 5 and 6 need explicit owner confirmation before running.

## 9. Matrix rows to add

| Actor | Action | Expected |
|---|---|---|
| Active member of the organisation | disconnect its Xero file | allowed |
| Support-grant holder (read-only) | disconnect | denied |
| Member of organisation A | disconnect organisation B's file | denied |
| Client viewer | disconnect | denied |
| Bare super admin, not a member | disconnect | denied |
| Any caller | read data from a `disconnected` connection | no data served |
| Reconnecting person | reconnect | only their own row changes |

## 10. Owner decisions

1. **A connection the client revoked — keep or remove its data?** Recommendation: **keep everything**, mark the connection disconnected, show existing figures with their "as at" date and a banner. Financial history is the value; deletion is irreversible.
2. **Existing duplicate rows — merge or leave?** Recommendation: **leave alone** — there are none, so a merge tool is unnecessary risk.
3. **Is `firm_id` mandatory on new connection rows?** Recommendation: **yes**, enforced in the database.
4. **Should the tidy-up screen (step 6) be built at all now?** Recommendation: **no** — zero orphans; revisit only if the count stops being zero.
5. **What happens when the plan has no room for a Xero file mid-authorisation?** Recommendation: refuse it and tell the user, rather than storing it unassigned.
