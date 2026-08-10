# Editable subscription levels + super-admin override

Two things: let a super admin create their own subscription levels (both organisation plans and client dashboard tiers), and give super admins a genuine override so they can run an organisation end to end — connect its Xero files, set every client setting, and open the dashboards.

## Current state (verified)

- Organisation plans (Starter/Growth/Scale/Firm/Free/Legacy) are hardcoded in `src/lib/firmPlans.ts` and locked by a database enum. Client limits per plan are hardcoded too.
- Client dashboard tiers (Standard/Advisory/Investigate/Multi company) are hardcoded in `src/lib/tiers.ts` and locked by a second database enum. Only their widget lists are editable today.
- Super admins are currently blocked from client data: dashboard access is granted only to firm members or users with an explicit client-access row, so a super admin cannot open a client dashboard or link Xero files for someone else.
- Xero file allowance per client comes from a `max_xero_orgs` field that is only allowed above 1 for the Multi company tier, and there is no UI to change it.

## 1. Subscription levels become data, not code

New "Plans" page in the Admin sidebar with two tabs.

**Organisation plans tab** — table of levels with add / edit / archive:
- Name shown to users, internal key, description
- Included clients (the quota)
- Sort order, and an enabled toggle so retired levels stop appearing in pickers but existing organisations keep working
- Existing six levels are seeded so nothing changes on day one

**Client dashboard tiers tab** — same table plus:
- Which widgets the tier includes (the existing tier-widget picker moves here)
- "Allows more than one Xero file" flag, replacing the hardcoded Multi-company rule
- Default Xero file allowance

Every plan/tier dropdown in the app (Add organisation, Subscription editor, new client subscription, upgrade options, health/badge labels) reads from this list instead of the hardcoded arrays.

## 2. Super-admin override

- **Override banner:** when a super admin opens an organisation or one of its clients, a persistent bar shows "Managing <organisation> as super admin". No more "no client data" restriction — super admins can open client dashboards, all widgets, and every settings page.
- **Plan override in the Subscription editor:** alongside tier/status/dates/always-free, add
  - Client limit override (blank = use the plan's quota)
  - Xero file allowance override for the organisation and per client, no longer gated by the Multi company tier
  - Widget override for this organisation (start from the tier, tick extras on/off)
- **Xero files from the organisation page:** a "Xero files" section listing every file connected to that organisation's clients, with
  - Connect with Xero run from inside the organisation — new files land against that organisation and can be assigned to any of its clients
  - Reassign a file to a different client, and unlink
  - Respects the allowance above, with a clear message when it is reached
- **Client settings from admin:** the row menu on the organisation page gets "Settings" wired for super admins to the full client settings (report basis, cost classification, tiers, notes).

## Technical notes

- Migration: create `plan_levels` (scope `firm` | `dashboard`, key, label, description, client_limit, xero_org_limit, allows_multi_org, sort_order, enabled, timestamps) with GRANTs, RLS, read for authenticated, writes restricted to super admins; seed the six firm plans and four dashboard tiers from the current constants.
- The two tier enum columns (`subscriptions.tier`, `client_access.tier`, `tier_settings.tier`, `tier_widget_config.tier`, `client_subscriptions` plan fields) convert to text keyed against `plan_levels`, preserving current values, so new levels are possible without further migrations.
- `firmPlans.ts` / `tiers.ts` keep their helper functions but source labels and limits from a cached server fn (`listPlanLevels`) instead of hardcoded records; the hardcoded maps stay only as fallback for the seeded keys.
- Access: `getEffectiveTier` in `src/lib/xero/access.server.ts` grants super admins advisor-level access to any tenant; the `max_xero_orgs` validation triggers relax to honour the per-client override rather than the Multi-company enum check.
- Xero connect from the org page reuses the existing OAuth state snapshot flow, passing the target firm/client so new tenants auto-link correctly.
