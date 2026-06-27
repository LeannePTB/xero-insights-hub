## Goal

On a client viewer's dashboard, after the widgets they're entitled to, show an "Available upgrades" section listing the other tiers (only those the firm has enabled in `/settings/tiers`) along with which extra widgets each unlocks — so viewers can request to upgrade.

## Where it goes

In `src/routes/_authenticated/clients.$clientId.index.tsx`, below the `SortableCardGrid`. Only renders for non-advisors (advisors already see every widget). Hidden when there are no higher enabled tiers, or when no tier offers widgets the viewer doesn't already have.

## What it shows

For each upgrade tier (in order Standard → Advisory → Investigate → Multi company, skipping the viewer's current tier and any lower tier):

- Tier name + short description (`TIER_LABEL` / `TIER_DESCRIPTION` from `src/lib/tiers.ts`).
- "Adds:" list of widget labels this tier unlocks beyond what the viewer currently sees (computed as `effective(tier) − effective(currentTier)`).
- A "Request upgrade" button that opens the user's mail client with a prefilled message to the advisor:
  - `mailto:` to the firm's contact email (uses the viewer's advisor — falls back to a generic toast "Contact your advisor to upgrade" if no email is available).
  - Subject: `Dashboard upgrade request — <client name>`
  - Body names the requested tier.

Tiers that are globally disabled in `tier_settings` are not shown (nothing to upsell).

## Data

New server function in `src/lib/tier-config.functions.ts`:

- `getUpgradeOptions({ clientId, currentTier })` — returns, for each higher tier that is `tier_settings.enabled = true`, the resolved widget list (using the same client-override → global → defaults resolution as `getEffectiveWidgets`). Single round-trip; no schema changes.

The dashboard route calls it after `widgetsQ` resolves and renders an `UpgradeOptions` component.

## Component

New `src/components/dashboard/UpgradeOptions.tsx`:

- Card-styled section titled "Other dashboards available".
- One row per upgrade tier with name, description, the diff widget chips, and the request button.
- Subtle styling (muted border, no drag handle) so it doesn't look like a data widget.

## Out of scope

- No billing / payment flow — this is a request-by-email signal only.
- Advisor view unchanged.
- No changes to tier resolution or `getEffectiveWidgets`.
