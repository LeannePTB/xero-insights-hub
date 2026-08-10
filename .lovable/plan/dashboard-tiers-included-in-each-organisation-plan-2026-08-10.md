# Dashboard tiers included in each organisation plan

Right now organisation plans (Starter, Growth, Scale, Firm, Free, Legacy) control how many clients and Xero files an organisation gets, but every organisation can grant any dashboard tier (Standard, Advisory, Investigate, Multi company) to its clients. This change makes the available tiers part of the plan.

## What changes

**On the Subscription levels page (Organisation plans tab)**
- Each plan gains an "Included dashboard tiers" picker — tick the tiers that plan can hand out to its clients.
- The tier list in the picker is the live Client dashboard tiers list, so any new tier you create can be added to plans.
- Seeded defaults so nothing breaks on day one:
  - Starter: Standard
  - Growth: Standard, Advisory
  - Scale: Standard, Advisory, Investigate
  - Firm: all four
  - Free forever / Legacy: all four
- The plans table shows a small summary of the included tiers per row.

**Everywhere a tier is chosen for a client**
- Tier dropdowns (granting client access, inviting a viewer, client settings, organisation page) only offer tiers included in that organisation's plan, and still respect the global on/off toggle for a tier.
- Tiers outside the plan appear greyed out with "Not in <plan name> plan" rather than vanishing, so it's obvious there's an upgrade path.
- Super admins can still assign any tier (override), with a note that it's outside the plan.

**Existing clients on a tier their plan no longer includes**
- Nothing is revoked automatically. The organisation page flags them: "On Investigate, not included in Growth" so you can upgrade the plan or move the client.

**Upgrade prompts**
- The client-side upgrade options card only advertises tiers the organisation's plan includes.

## Technical notes

- Migration: add `allowed_tiers text[] not null default '{}'` to `public.plan_levels`, then backfill the six firm-scope rows with the defaults above. Dashboard-scope rows ignore the column.
- `plan-levels.functions.ts`: include `allowed_tiers` in `COLS`, the `PlanLevel` type, and the `savePlanLevel` validator/row (normalise to keys that exist in dashboard-scope rows).
- New helper (e.g. `src/lib/plan-tiers.ts`): `tiersForPlan(levels, firmTierKey)` returning the allowed tier keys, with the "all tiers" fallback for plans with an empty list so legacy data keeps working.
- Server-side enforcement in the access-granting server fns (`src/lib/access.functions.ts`, invite creation in `src/lib/invites.functions.ts`) — reject a tier outside the firm's plan unless the caller is a super admin.
- UI updates: `admin.plans.tsx` (tier checkboxes in the firm-scope editor + table column), `firms.$firmId.tsx` (tier pickers and the out-of-plan flag), client settings tier picker, and `UpgradeOptions.tsx`.
