# Remove legacy subscription screens and move limits to the organisation model

## Classification and confirmed dependency

**SECURITY-RELEVANT.** This changes where database-enforced organisation limits are resolved, but it does not change who may read or write any row.

The live database confirms both limit triggers still depend on the legacy catalogue:

- `app_private.enforce_client_limit()` raises `PLAN_LIMIT_CLIENTS` but gets its limit from `app_private.firm_limits()`.
- `app_private.enforce_xero_org_limit()` and its move variant raise `PLAN_LIMIT_XERO_ORGS` through the same helper.
- `app_private.firm_limits()` currently reads `subscriptions.tier → plan_levels.client_limit/xero_org_limit`.

Therefore `plan_levels` cannot safely be retired later until this dependency is moved. Bangkok On Darby and Autotek NSW both currently have one client and `org_subscription_options.client_limit = 1`.

**Security invariants:** database triggers remain the sole enforcement point; caller-supplied organisation IDs remain filters; MFA and access policies remain unchanged; `super_admin` alone gains no client data. The threat is a missing purchase row accidentally becoming unlimited, or UI removal leaving organisation creation without a limit row.

## Implementation

### 1. Move both organisation limits to `org_subscription_options`

- Add one migration replacing `app_private.firm_limits(_firm_id)` so it reads `org_subscription_options.client_limit` for both client count and organisation-wide Xero-file count, matching the approved one-file-per-client model.
- Fail closed when an organisation has no purchase row; do not treat a missing row as unlimited.
- Keep the existing client and Xero trigger functions and their exact `PLAN_LIMIT_CLIENTS` / `PLAN_LIMIT_XERO_ORGS` messages.
- Keep `plan_levels`, `subscriptions`, `client_subscriptions`, and `tier_widget_config` unchanged as rollback data.

### 2. Make organisation creation complete under v2

- Update both organisation-creation paths to create `org_subscription_options` in their existing all-or-nothing workflow.
- Default new organisations to one client, Advisory off, Consolidation off, and bookkeeping billing.
- Remove legacy plan/tier/status/date choices from the Add organisation dialog and its user-facing audit wording; retain the legacy `subscriptions` row only as inert rollback data.

### 3. Remove every active legacy subscription screen and control

- Delete the `/admin/plans` Subscription levels route and `/settings/tiers` Tier widgets route.
- Remove both sidebar links and remove those paths from the shared admin-layout handling.
- Remove the legacy subscription editor from the admin organisation detail page.
- Remove the old Plan & subscription summary, Organisation plans table, cancellation controls, legacy included-tier/default-card panel, and old billing wording from organisation settings; keep the live `OrgPurchaseCard`, organisation trial controls, clients, Xero files, people, ownership, and support access.
- Remove every mounted per-client tier/trial control and legacy tier preview choice. Client settings retain only the v2 card tick list.
- Remove stale client-list fallback tier badges, trial labels, pencil links, and bulk tier control. “View as client” remains and keeps its existing database audit/access checks.
- Delete UI-only legacy components that no longer have callers. Retain database tables, functions, server helpers, and v1 card-resolution branches for the one-week rollback period.
- Sweep active routes/components so no person sees copy derived from or describing `plan_levels`, `client_subscriptions.tier`, or `tier_widget_config`.

### 4. Proof and documentation

- Add regression coverage proving `firm_limits` reads `org_subscription_options`, not `plan_levels`, for both client and Xero limits, including missing-row fail-closed behaviour.
- In a transaction that always rolls back, attempt to insert a second client into Bangkok On Darby and confirm the exact `PLAN_LIMIT_CLIENTS: this organisation's plan allows 1 client(s). Upgrade to add more.` refusal.
- Prove Autotek NSW remains 1/1 and the Xero-file trigger still uses the same organisation limit source.
- Run typecheck, the full security suite and live access matrix, `public.security_posture()`, and the database linter. Confirm no new findings and update the security backlog/spec to state that `org_subscription_options` is now the limit source.

## Not included

- No table, column, legacy database function, v1 card branch, or historical row is deleted.
- No payment system is added.
- Final retirement of rollback storage happens only after the new model has run for one week, as a separate approved change.
