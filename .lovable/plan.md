# Consolidated view for multi-company clients

Clients on a Multi company tier link several Xero files. Today the dashboard always renders one set of cards per file. This adds a consolidation option so an advisor can choose to show a single combined view instead — across the files they pick.

## What the advisor sets (client settings)

In the client's settings, under the Xero organisations section, a new "Consolidation" panel appears **only** when the client's tier allows multiple Xero files:

- Display mode: **Individual companies** (default) or **Consolidated**
- Companies to consolidate: tick boxes for each linked Xero file (defaults to all)
- A note explaining that intercompany balances between the selected files are netted out using the loan pairings already configured on the Loan Consolidation page

Saved per client, so the client viewer sees whatever the advisor chose.

## What the client dashboard shows

When the mode is Consolidated:

- **Aged Receivables (consolidated)** — one card summing the ageing buckets of the selected companies, with a per-company breakdown line underneath so it's clear where the balance sits.
- **Aged Payables (consolidated)** — same treatment.
- Intercompany amounts are removed: any receivable/payable that sits on an account pair configured in Loan Consolidation for two of the selected companies is excluded from the combined totals, and shown as a separate "Intercompany eliminated" line so the numbers reconcile back to the raw sum.
- **Loan Consolidation** keeps exactly the layout and settings structure ported from the Hub project — the same matrix card, the same Loans page and Loan accounts pairing screen, the same `loan_consolidation_accounts` pairing model. Nothing about it is redesigned; it is only scoped to the companies ticked for consolidation, and it stays the single place where account pairings are configured.
- All other cards (P&L, health, tax, break-even, cashflow, audit) keep rendering per company as they do now.

Companies not ticked keep showing individually so nothing disappears.

## Technical notes

- Migration: add `consolidation_mode text not null default 'individual'` and `consolidation_org_ids uuid[] not null default '{}'` to `public.clients`. No new table needed; existing client policies and grants cover it.
- `src/lib/clients.functions.ts`: return the two new fields on `getClient`; add a `saveClientConsolidation` server fn (advisor/firm-member/super-admin only, reusing `userCanManageClient`) that validates the mode is only settable when `getClientOrgAllowance().isMulti` is true and that every selected id is a linked `client_xero_orgs` row.
- New `src/lib/xero/consolidated.functions.ts`: `getConsolidatedAgeing({ clientId, kind: 'receivables' | 'payables' })` — fetch each selected tenant's ageing via the existing receivables/payables server helpers in parallel, sum buckets, then subtract intercompany amounts derived from the Hub-ported pairing engine (`loan_consolidation_accounts` + `loan-recon.server.ts` / `loan-mismatch.server.ts`) where both sides belong to selected tenants. No new pairing model or parallel settings screen — it reads the same pairings the Loans pages already manage. Returns `{ total, buckets, perCompany[], eliminated }`. Access checked with the existing `assertWidgetAccess` for `receivables` / `payables`.
- New `src/components/dashboard/ConsolidatedAgeingWidget.tsx` rendering that DTO, with a per-company list and the eliminated line, styled to match the existing `LoanConsolidationWidget` card.
- `src/routes/_authenticated/clients.$clientId.index.tsx`: when consolidation is on, replace the per-org receivables/payables cards for the selected orgs with the two consolidated cards, and pass the selected tenant list to `LoanConsolidationWidget` (and through to `clients.$clientId.loans.tsx` / `loans-accounts.tsx`, which keep their current Hub layout).
- New `src/components/dashboard/ConsolidationPanel.tsx` in client settings, gated on the multi-org allowance, following the same section/settings pattern as the existing Loan accounts screen.

## Out of scope for now

P&L, tax/super, break-even, cashflow and health stay per company — those can be consolidated later once the receivables/payables view is proven.
