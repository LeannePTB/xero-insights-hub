# Phase 5 — step 5 (orphan prevention) + disconnect dialog wording

Classification: **SECURITY-RELEVANT** — `xero_connections`, plan limits, `supabaseAdmin` in the OAuth callback, audit. Invariants touched: 4 (caller ids are filters), 6 (one rulebook — plan limits stay in the database), 8 (no tokens in logs or audit meta), 9 (never loosen).

## Part A — dialog wording and safety (client settings)

The disconnect dialog said disconnecting "removes the connection here", which is no longer true. Rewritten as two clearly separated blocks:
- **Unlink from this client** — removes the link only; the connection stays live and can be linked to another client in the organisation.
- **Disconnect from Xero** — revokes our access at Xero; the file stays listed as "Reconnect required", history and saved figures are kept, and reconnecting restores it to this client with no re-linking.

The destructive action now sits in its own bordered block with a normal-weight outline button for unlink, so the two are no longer adjacent equal-weight buttons. Cancel stays in the footer. The unassigned-connections card's disconnect wording is corrected the same way. No behaviour change in this part.

## Part B — orphan prevention at the source

Remaining causes, verified in code before building:
1. the connect/onboard callback retried a refused tenant as an **unstamped** row (`firm_id` null) — the live orphan factory;
2. a flow with no client or organisation built rows with no organisation at all;
3. `detachXeroOrg` cleared `firm_id` on unlink, leaving an unassigned row behind.

Fixes: every stored row carries the organisation that already owns the file, otherwise the one the flow was started for; a tenant with neither, or one the plan has no room for, is refused, audited (`xero_file_refused`) and reported using the database's own `PLAN_LIMIT_XERO_ORGS` wording; unlink keeps the organisation stamp.

Database (read-only count first — 12 rows, 0 null, 0 mismatched): `firm_id` is `NOT NULL`, plus deferred constraint triggers so a Xero file must belong to the same organisation as the client it is linked to. Deferred so `move_xero_file_to_client` can relink and restamp in one transaction. No row was modified, no Xero call was made.
