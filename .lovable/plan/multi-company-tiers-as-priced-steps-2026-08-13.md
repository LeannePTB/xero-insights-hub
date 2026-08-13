# Multi company tiers as priced steps

## What's actually going on

You have **one** organisation plan called "Multi Companies", but **two** dashboard tiers in the tier catalogue:

- `multi_company` — labelled "Multi company 5", 5 Xero files
- `multi_10` — labelled "Multi company 10", 10 Xero files

The checkbox list you saw is the tier picker on an organisation plan, not a list of plans. The "Multi Companies" plan currently includes Standard, Advisory, Investigate and Multi company 10 (not Multi company 5), which is why the 5 option shows unticked.

So nothing is broken — it's just unclear which is which, and there's no obvious "what does this step cost / include" anywhere.

## Decision

Keep multiple Multi company tiers as priced steps (5, 10, 20 …). Each is a distinct tier with its own Xero file limit, and each organisation plan chooses which of them it may hand out. The work below makes that model explicit and safe.

## What changes

**Tier catalogue (Client dashboard tiers page)**
- Show the Xero file limit as part of each tier row and in the editor, so "Multi company 5" vs "Multi company 10" is self-evident rather than guessed from the name.
- Add a "Multiple Xero files" flag column, already stored, so a new multi step can be created by duplicating an existing one and changing only the limit.
- Warn on save if a tier allows multiple files but has a limit of 1 (a duplicate created and not adjusted).

**Organisation plans page**
- In the "Dashboard tiers" cell and the editor checkboxes, show each multi tier's file count next to its label ("Multi company 10 · 10 files").
- Flag a plan whose `xero_org_limit` is lower than the largest multi tier it includes, since the org-level cap would silently override the tier.

**Organisation page ("What's included")**
- List the included tiers with their file allowance, so an advisor can see the ceiling their clients can be put on.

**Client side**
- No behaviour change: a client's allowance is still the highest limit among the tiers granted on its access records, further raised only by an explicit per-client `max_xero_orgs`. Client settings gains a one-line note explaining where the number comes from ("Multi company 10 tier — 10 Xero files").

**Naming clean-up**
- Rename `multi_company` from "Multi company 5" to "Multi company 5 files" style labelling consistently across both rows (labels only — keys stay as they are so existing client access rows keep working).

## Technical notes

- No schema change. `plan_levels.xero_org_limit` and `allows_multi_org` already drive everything; `getClientOrgAllowance` in `src/lib/xero/client-orgs.server.ts` already reads the catalogue instead of a hardcoded key.
- `src/lib/tiers.ts` still hardcodes `DashboardTier` to the four original keys plus `MULTI_ORG_TIER = "multi_company"`. Loosen these to `string`-keyed lookups with fallbacks so `multi_10` (and any future `multi_20`) is a first-class tier for labels, descriptions and default widgets, instead of falling through to defaults.
- `src/lib/tier-config.functions.ts` line ~174 orders tiers by a hardcoded array; switch to the catalogue's `sort_order` so new multi steps rank correctly when resolving a client's default widget set.
- UI touch points: `src/routes/_authenticated/settings.tiers.tsx`, `src/routes/_authenticated/admin.plans.tsx`, `src/routes/_authenticated/firms.$firmId.tsx`, `src/routes/_authenticated/clients.$clientId.settings.tsx`.
- Pricing itself stays outside the app (billing is handled off-platform today); these are entitlement steps you charge for manually.
