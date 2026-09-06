# Security backlog — Traction Advisory

Verified against code and database 6 September 2026. Re-verify before acting on any item.
Referenced by Access Control Spec §12. Update this file in the same change that closes an item.

## Closed — do not reopen on the strength of an older note

- **Token column exposure.** `authenticated` holds SELECT on 13 non-token columns of `xero_connections`; `access_token_enc` and `refresh_token_enc` have no grant. The privilege check runs before RLS, so a browser read of those columns fails before any policy is evaluated. No `select *` against that table exists in the codebase.
- **`FORCE ROW LEVEL SECURITY` — WON'T DO.** All `public` tables are owned by `postgres`, which has `rolbypassrls`; `service_role` bypasses too. FORCE is evaluated after BYPASSRLS, so it changes nothing for any role the app connects as. Only worth revisiting if table ownership moves to a non-bypass role.
- **Plan `free` / `pt` enum.** No `free` row exists in `plan_levels`. `pt` appears in no `allowed_tiers`. `plan-tiers.ts` filters unknown keys and falls back to `basic`; nothing casts a raw string to `dashboard_tier` (enum: `basic, advisory, investigate, multi_company`).
- **Grant hygiene, 6 Sep 2026.** `anon` DML revoked on `xero_snapshots` and `xero_snapshot_runs`; `INSERT` revoked from `authenticated` on `audit_log`. Both were denied by RLS beforehand — the grants contradicted the model, they were not live holes.
- **OAuth return-origin allow-lists, 6 Sep 2026.** `*.lovable.app` wildcard removed. Single `assertAppOrigin` in `src/lib/site-origin.ts` used by every `return_origin` writer; `getSafeReturnOrigin` validates every redirect consumer against the same explicit host list.
- **Function tidy-up round 1, 6 Sep 2026.** `app_private.shares_firm_with` now requires `status = 'active'` on both sides of the join (defect: removed/suspended members still counted). `public.xero_tenant_already_linked` EXECUTE revoked from `authenticated`/`anon`/`PUBLIC` — only `service_role` callers exist. `public.xero_missing_scopes` keeps EXECUTE for `authenticated` (called through `context.supabase`) and now resolves the connection's `firm_id` and requires `has_firm_access` or `platform_staff_can_access_firm`, returning `null` otherwise. `app_private.firm_ids_for_tenant` **left unchanged**: the `snoozes write for firm staff` policy on `audit_finding_snoozes` calls it directly, so revoking EXECUTE from `authenticated` would break that policy.


## Open

1. **18 `SECURITY DEFINER` functions executable by `authenticated`** — untriaged. Each runs as `postgres` (BYPASSRLS), so any one with a weak internal check is a full RLS bypass.
2. **Two dead ALL-command policies on `xero_connections`** (`Users manage own xero connections`, `firm owners manage firm xero connections`). Unreachable for writes today because `authenticated` has no DML grant on the table, but they would silently restore write access if a table-level grant ever returned. Retire or re-scope.
3. **`xero_oauth_states` policy targets `PUBLIC`, not `authenticated`** — Access Control Spec §6 forbids this. `authenticated` holds full DML on the table; the only thing denying access is `auth.uid() = user_id`.
4. **Path B audit rows.** `logXeroRead()` records `meta.access_path` on live Xero calls only (`api.server.ts:401`, `:504`), and skips it when `conn.firm_id` is null. Reads served from stored data write no audit row at all: `snapshot-read.server.ts`, `verdicts.functions.ts`, `client_reports`, `reconciliation_snapshots`, `report_cache`, `audit_findings`, and `search.functions.ts` — the last being the widget built specifically for support-grant holders.
5. **`loan-consolidation.functions.ts:178`** selects `tenant_id, tenant_name` for every connection in the database via `supabaseAdmin`, unfiltered by organisation. Callers filter afterwards; no leak to a response was confirmed.
6. **`tier_settings`** has rows for `advisory` and `basic` only — `investigate`, `multi_company` and `wip` have no kill switch. `investigate` is in the enum but has no plan row; decide whether it is retired.
7. **DRTABT Projects has 12 clients on `multi` (limit 10)** — no more until raised or overridden.
8. **3 super_admin accounts**, all Positive Traction. Confirm each is needed and MFA-enforced. Outside the codebase.
9. **GST treatment undecided** — TODO in `billing-checkout.functions.ts`. Do not guess.
10. **`sandbox_exec`** (Lovable platform role, not application code) holds `SELECT, INSERT` on `xero_connections` including both token columns, and has `rolbypassrls`. Raise with Lovable; cannot be fixed from here.

## Standing caution

This list records what has been looked at, not what exists. Absence from it is not evidence of safety.
