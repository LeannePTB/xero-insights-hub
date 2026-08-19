# Access-control sweep — findings (read-only audit, nothing changed)

Scope: every `createServerFn` in `src/lib/**` and every route under `src/routes/api/**`, plus the RLS policies behind them (checked directly against the database).

Role facts that set urgency: `handle_new_user` grants `advisor` only to the very first user and `client_viewer` to everyone after. Current role counts: 3 `super_admin`, 3 `advisor`, 2 `firm_owner`, 1 `client_viewer`. So a "bare advisor check" is reachable only by the 3 advisor accounts (all Positive Traction today), while a "no check, RLS only" path is reachable by any signed-in user — but only leaks if the RLS policy is weak. Every RLS policy I inspected on the tables involved is scoped through `app_private.has_firm_access` / `has_client_access` / `user_can_manage_client`, so RLS-only paths are, as far as the database goes, sound.

## Rank 1 — exploitable today, cross-organisation data

### 1. `src/lib/xero/audit.functions.ts` — `runXeroAudit`, `getLatestAudit`, `snoozeFinding`, `resolveFinding`, `unsnoozeFinding`
- Check performed: `assertAdvisor` (lines 8-16) — a bare `user_roles` read for `advisor` or `super_admin`. Nothing else.
- Should perform: resolve `tenantId` → client → organisation server-side and call `user_can_access_firm` / `assertWidgetAccess`, as `access.server.ts` does.
- Identifier from request: yes, `tenantId`, used directly by `getConnectionByTenant` and by every `supabaseAdmin` read/write of `audit_runs`, `audit_findings`, `audit_finding_snoozes`.
- Exploitable: yes, by any of the 3 advisor/super_admin accounts, against any Xero file in the platform. This is the same class as the `TransactionSearch` bug, and being super_admin alone grants access here — a direct breach of invariant 3.

### 2. `src/lib/xero/connections.functions.ts` — `getTenantCurrency` (77-113)
- Check performed: authentication only. The first read is RLS-scoped, so a non-entitled caller gets `null` — but the fallback at 91-110 then calls `getConnectionByTenant` via `supabaseAdmin`, hits the live Xero `Organisation` endpoint and writes `base_currency` back.
- Should perform: `assertWidgetAccess` or a tenant→firm ownership check before the fallback.
- Identifier from request: yes, `tenantId`, unverified.
- Exploitable: yes, by **any signed-in user** (a `client_viewer` included) for any tenant whose cached currency is empty. Leaks only base currency plus confirmation the tenant exists, and burns a Xero API call, but it is an unauthenticated-for-that-tenant admin-client read.

### 3. `src/lib/xero/scenario.functions.ts` — `getScenarioData` (204-345)
- Check performed: `assertWidgetAccess(userId, data.tenantId, "cashflow_scenario")` — correct for the tenant.
- Missing: `data.clientId` is a separate request field, never cross-checked against `tenantId`, then used to filter two `supabaseAdmin` reads (`client_cost_classifications` 255-260, `scenario_exclusions` 261).
- Exploitable: yes, for anyone entitled to any one tenant — swap in another client's id and read their cost-classification tags and excluded invoice ids. Not ledger data, but cross-client.

### 4. `src/lib/tier-config.functions.ts` — `saveTierWidgets` (67), `setTierEnabled` (258), `saveClientWidgets` (484)
- Check performed: `assertAdvisor` (9-16), a bare role read, with no scoping to the `clientId`/`firmId` being written, then the write goes through `supabaseAdmin`, bypassing the (correct) `tier_widget_config` RLS policy.
- Exploitable: yes, by any advisor, against any organisation's widget configuration. Write-side, not a read leak, but it changes another organisation's entitlement surface. Note `saveFirmDefaultWidgets` (595-616) in the same file does it properly — re-checks `firm_members` — so the fix pattern is already in the file.

### 5. `src/lib/unreconciled.functions.ts` — `assertClientAccess` (121-134), `uploadStatementLines` (139), `deleteUpload` (236)
- `assertClientAccess` grants a full bypass to anyone holding an `advisor` row anywhere; only non-advisors are checked against `client_access`. The uploads/deletes then run through `supabaseAdmin`.
- Exploitable: yes, by any advisor, against any client. RLS on `unreconciled_uploads` / `unreconciled_lines` is correct, but `supabaseAdmin` skips it.

### 6. `src/lib/login-log.functions.ts` — `listLoginEvents` (28-58)
- Check: bare `advisor` role. The query has no firm filter, and display names are resolved via `supabaseAdmin`.
- The `login_events` RLS policy is correctly scoped (`is_advisor AND shares_firm_with`), so the app-level query is *wider than the database intends* — but it runs on `context.supabase` for the events themselves, so RLS still bites. The `supabaseAdmin` profile lookup is the leak: display names/emails for users outside the caller's organisation.
- Exploitable: partially, by an advisor. Low value, but it is a bare-role check standing in for an access check.

## Rank 2 — no app-level check, currently held up by RLS alone

These take an identifier from the request and query with it before verifying anything, relying entirely on RLS. I verified each backing policy in the database and each one is scoped correctly, so none is exploitable today — but they violate invariant 4's spirit and would become live bugs the moment a policy is loosened or the code switches to `supabaseAdmin`.

- `src/lib/admin-plan-usage.functions.ts` — `listOrganisationUsage` takes `firmIds[]`, no `assertSuperAdmin` unlike every sibling in `admin.functions.ts`. Runs on `context.supabase`.
- `src/lib/true-breakeven.functions.ts` — `getTrueBreakevenInputs`, `upsertTrueBreakevenInputs`: no check at all. RLS on `client_true_breakeven_inputs` is `user_can_manage_client` / `has_client_access`. Safe today.
- `src/lib/cost-classification.functions.ts` — all three functions, same shape. RLS on `client_cost_classifications` is correct.
- `src/lib/clients.functions.ts` — `listClientNotes`, `addClientNote`, `updateClientNote`, `deleteClientNote`, `renameClient`, `updateClientReportBasis`, `updateClientBasisOverride`, `listClientAccess`, `revokeClientAccess`: RLS-only. Policies on `client_notes` / `client_access` are correct.
- `src/lib/xero-errors.functions.ts` — `listXeroApiErrors` filters on a caller-supplied `firmId`; `xero_api_errors` RLS is correct (`has_firm_access OR platform_staff_can_access_firm OR is_super_admin`).
- `src/lib/widget-access.functions.ts` / `src/lib/plan-tiers.functions.ts` — take `clientId`/`firmId` and forward to RPCs through `context.supabase`; the RPCs are the gate.
- `src/lib/billing.functions.ts` — `getClientBilling` and `setClientDashboardTier` are documented RLS-trust; `client_subscriptions` policies are correct.
- `src/lib/tier-config.functions.ts` — `getFirmPlanSummary`, `getUpgradeOptions`, `getOrgWidgetMatrix`, `listTierConfig`, `getEffectiveWidgets`: reads via `context.supabase`, no explicit check.
- `src/lib/dashboard-layout.functions.ts` — `clientId` unverified but every query is also keyed to `context.userId`; blast radius is the caller's own preference row.

## Rank 3 — silent empty instead of explicit refusal

- `clients.functions.ts` `renameClient` / `updateClientReportBasis` / `updateClientBasisOverride`: an unauthorised call returns `{ ok: true }` with zero rows updated.
- `clients.functions.ts` `listClientAccess` returns `{ access: [] }`.
- `consolidation-groups.functions.ts` `getConsolidationGroup` (207-258): computes `canSeeFigures = false` for a super admin with no active support grant, then returns the full `clients` array with `tenantId`/`tenantName` anyway — the server trusts the UI to hide it. This is a Path B violation (invariant 3) and arguably belongs in Rank 1.
- `health.functions.ts` `getBusinessHealthDetail` (576-582): `clientId` is optional; when omitted the `supabaseAdmin` read of `client_cost_classifications` is filtered by `tenant_id` only, returning tags for every client on that tenant.

## Clean — checked and found correct

- `src/lib/xero/search.functions.ts` — the reference implementation: `assertClientDataAccessForClient` + `assertClientWidget`, permitted tenant set derived server-side, defensive re-check before each Xero call, explicit throw rather than empty result.
- `src/lib/xero/recon-snapshot.server.ts` (behind `fixed-assets`, `gst`, `reconciliation`) — cross-validates `clientId` and `tenantId` against `client_xero_orgs` under the caller's RLS before any Xero call.
- `src/lib/loan-consolidation.functions.ts` — every handler resolves `clientId`/`groupId` → `firmId` and checks membership plus a widget gate before `supabaseAdmin`; id-scoped mutations re-derive ownership first.
- `src/lib/xero/reports.functions.ts`, `payables`, `receivables`, `cashflow` — `assertWidgetAccess` before `getConnectionByTenant`, consistently.
- `src/lib/xero/consolidated.functions.ts`, `scope-status.functions.ts`, `orphan-connections.functions.ts` (super-admin metadata only), `reconnect-all.server.ts` (`platformStaffCanAccessFirm` at line 85).
- `src/lib/admin.functions.ts` (all handlers `assertSuperAdmin` first), `security.functions.ts`, `firms.functions.ts`, `firm-subscription.functions.ts`, `ownership.functions.ts`, `support-access.functions.ts`, `invites.functions.ts`, `billing-checkout.functions.ts` (calls `user_can_access_client` — the model), `roles.functions.ts`, `access.functions.ts`, `xero-assessment.functions.ts`.
- `src/routes/api/public/stripe/webhook.ts` (signature verified before any write, idempotent) and `src/routes/api/public/xero/callback.ts` (state row validated, tenant/firm link checked before any connection write).
- `src/lib/xero/connections.functions.ts` `moveXeroFileToClient`, `startXeroConnect`, `linkClientXeroOptions`, `listClientXeroOptions`, `disconnectXero` — all properly gated. `checkXeroConnection` (115-133) is the one loose end: no check, confirms tenant existence to any signed-in user.

## Suggested fix order (for a separate task, on your say-so)

1. `xero/audit.functions.ts` — replace `assertAdvisor` with tenant-resolved `assertWidgetAccess`.
2. `getTenantCurrency` + `checkXeroConnection` — gate before the admin-client fallback.
3. `scenario.functions.ts` — cross-check `clientId` against `tenantId`.
4. `tier-config.functions.ts` writes + `unreconciled.functions.ts` — scope the advisor check to the organisation, following `saveFirmDefaultWidgets`.
5. `consolidation-groups.getConsolidationGroup` — withhold the data server-side when `canSeeFigures` is false.
6. Rank 2: add explicit `user_can_access_client` / `user_can_access_firm` calls as defence in depth, and turn Rank 3's silent successes into refusals.

Nothing was changed and no database object was touched; the only database access was read-only policy and role inspection.
