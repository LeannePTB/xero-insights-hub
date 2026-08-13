# Show what the organisation's plan includes

On the organisation page (e.g. DRTABT Projects), the Plan & subscription card only shows the plan name, status and client count. It doesn't say which dashboard tiers and cards that plan actually includes — which is what every new client inherits by default.

## What changes

**Plan & subscription card**
- Keeps the existing plan badge, status and "1 of 12 clients used".
- Adds a line of limits: clients allowed, Xero files per client, and whether multiple Xero files per client are allowed.
- Adds "Dashboard tiers included": the tier chips from the plan (Standard, Advisory, Investigate the Numbers, Multi company), matching the chips already shown in the Clients table.
- Adds "Cards included by default": the full list of widget names the plan allows (Business Health, Aged Receivables, Profit & Loss, etc.), shown as small chips.
- A short note underneath: "New clients start with these cards. Open a client's settings to turn individual cards on or off for them."
- Collapsed by default behind a "What's included" toggle so the card stays compact; expanded state is remembered for the session.

**Nothing else changes** — per-client overrides continue to live in each client's settings panel, and the plan itself is still only editable by a platform admin.

## Technical notes

- Read plan definitions with the existing `usePlanLevels("firm")` hook and match on `plan.tier` from `getMyFirm` to get `allowed_tiers`, `client_limit`, `xero_org_limit`, `allows_multi_org`.
- Derive the default card list the same way the per-client panel does: union of `DEFAULT_TIER_WIDGETS` for each tier in `allowed_tiers` (empty `allowed_tiers` = all tiers), labelled via `WIDGET_LABEL`. Prefer the tier-level widget config already used by `getClientWidgets` so the two views can't drift; if it isn't reachable client-side, add a small read-only server fn `getFirmPlanSummary({ firmId })` in `src/lib/tier-config.functions.ts` that returns tiers + available widgets for the firm's plan and use that instead.
- All changes in `src/routes/_authenticated/firms.$firmId.tsx` (plus the optional server fn). No schema changes.
