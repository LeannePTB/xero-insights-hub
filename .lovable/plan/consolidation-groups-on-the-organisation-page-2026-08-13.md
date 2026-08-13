# Consolidation groups on the organisation page

Consolidation moves out of individual client settings and onto the organisation page, where you tick the clients (companies) to combine and get a consolidated view for the group.

## What you'll see

On the organisation page, below the client list, a new **Consolidation groups** card:

- **New group** — name it (e.g. "Trading group") and tick the clients in this organisation to include. Only clients with a linked Xero file can be ticked, and a client can sit in only one group.
- Each group shows as a row: name, the companies in it, and **Open**, **Edit**, **Delete**.
- Groups are only available when the organisation's plan allows multi-company; otherwise the card explains the plan needs upgrading.

**Open** goes to a consolidated view for that group:

- Header with the group name and the list of companies included.
- **Consolidated Accounts Receivable** and **Consolidated Accounts Payable** cards — combined totals and ageing buckets, with a per-company breakdown line and an "Intercompany eliminated" line so the numbers reconcile back to the raw sum.
- The **Loan Consolidation** matrix, exactly the Hub-ported layout already in the app, scoped to the group's companies, with its existing Loan accounts pairing screen for setting the pairings that drive elimination.
- Every client still appears individually in the organisation's client list, and each client dashboard is unchanged.

## Removed

The **Consolidation** panel inside client settings goes away — it was per-client across that client's own Xero files, which doesn't match how you use it (one client per Xero file).

## Technical notes

- Migration: new `public.consolidation_groups` (firm_id, name) and `public.consolidation_group_members` (group_id, client_id, unique on client_id so a client belongs to one group). Grants for `authenticated` and `service_role`; RLS scoped to firm members and super admins via the existing membership pattern.
- Drop the now-unused `clients.consolidation_mode` / `consolidation_org_ids` usage from `getClient` and remove `saveClientConsolidation`, `ConsolidationPanel`, and the consolidated cards from `clients.$clientId.index.tsx`. Columns can stay in the table, unused.
- New `src/lib/consolidation-groups.functions.ts`: `listConsolidationGroups({ firmId })`, `saveConsolidationGroup`, `deleteConsolidationGroup`, all gated on firm membership / advisor / super admin, plus a multi-company plan check reusing `getClientOrgAllowance` logic at firm level.
- `src/lib/xero/consolidated.functions.ts`: change `getConsolidatedReceivables` / `getConsolidatedPayables` to take `{ groupId }`, resolve the group's clients to tenant ids via `client_xero_orgs`, and keep the existing aggregation and intercompany elimination against `loan_consolidation_accounts`.
- New route `src/routes/_authenticated/firms.$firmId.consolidated.$groupId.tsx` rendering the two consolidated cards plus `LoanConsolidationWidget` scoped to the group's tenants.
- New `src/components/admin/ConsolidationGroupsSection.tsx` used on `firms.$firmId.tsx` (and reusable on the admin organisation page).
- Super admins keep the "no client data" rule: the consolidated view is advisor/owner only; super admins see the group setup but not the figures.
