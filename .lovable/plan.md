## Why the Tiers column is empty

The "Tiers" badges are derived from `client_access.tier` rows — that table stores **per-viewer grants** (which advisor has which tier for a client), not which tiers the client itself has enabled. Since the two clients in Positive Traction have no additional viewers assigned (only you as firm owner, who bypasses `client_access`), there are no rows and the column renders "—".

There is no `client_access` row for firm owners / super-admins because they access clients via ownership, not per-user grants. So the current data source will never light up for those users.

## What to change

Switch the Tiers column to reflect **the client's own enabled tiers** instead of viewer grants:

1. In `src/lib/clients.functions.ts` → `listClients`:
   - Also fetch `tier_widget_config` rows already loaded, and for each client compute `clientTiers` = the set of tiers with any widget rows for that client, unioned with the `grantedTiers` set (so nothing existing breaks).
   - If no per-client override exists, fall back to `enabledTiers` from the firm-wide `listTierSettings` (i.e. every tier the firm has switched on is available to the client by default).
   - Return `clientTiers: DashboardTier[]` on each client alongside the existing `grantedTiers`.

2. In `src/routes/_authenticated/firms.$firmId.tsx`:
   - Render `c.clientTiers` (intersected with `enabledTiers`) instead of `granted`.
   - Keep the "—" fallback only when the firm has zero tiers enabled.

Result: Both Home Hunter Watch and Positive Traction will show badges for every tier active in the firm's tier settings (Standard, Advisory, etc.), matching what actually drives the dashboard split.

## Out of scope

No schema changes, no billing changes, no access-control changes. Purely a display fix on the firm client table.
