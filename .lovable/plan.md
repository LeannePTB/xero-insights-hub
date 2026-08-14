# Company Loan Consolidation — match the Business Hub

Bring the Hub's Loan Consolidation tool across to Traction Advisory so it behaves identically: tabs, group-then-file selection, exports, and saved reports — driven by the organisations, clients and Xero files already linked here.

## What you'll get

A single **Company Loan Consolidation** screen with three tabs, exactly like the Hub:

- **Matrix** — pick a **Group**, then a **Xero file** (or "All Xero files"), and a **Balance as at** date. The reconciliation table shows each loan account, its balance, its paired counterparty account, the net, and a Balanced / Mismatch / Unpaired status. Clicking a row opens the mismatch detail (the transaction-level differences), as it does today.
- **Groups** — create and edit the consolidation groups and tick which companies belong to each.
- **Accounts** — per Xero file, choose which chart-of-accounts liability accounts are loans, and pair each one with its counterparty account in the other file.

Top right: **Download PDF**, **Download Excel**, and **Save report** (a saved snapshot of the matrix as at that date, listed so you can reopen it later).

Groups here reuse the organisation's existing consolidation groups, so **DRTABT** (12 companies) is already the group you pick — no separate group list to maintain.

## Replacing the old screen

The current per-client loans page and its "Set up accounts" page are folded into this one screen. Existing links from a client dashboard and from the consolidated group view point at the new Matrix tab with that group and Xero file preselected, so nothing dead-ends.

## Seeding DRTABT

Traction and the Hub authorise the same Xero files, so the loan accounts and their pairings can be rebuilt here rather than hand-entered:

1. For each of the 12 DRTABT companies, read the liability chart of accounts from Xero and pick up the intercompany loan accounts.
2. Pair each one with the matching account in the counterparty company (matched on company name in the account name, e.g. X1's "Loan - X4" against X4's "Loan - X1").
3. Load those rows as the DRTABT group's account setup, then run the matrix as at today and check it against the Hub's matrix.

Anything that doesn't pair automatically is listed as **Unpaired** on the Accounts tab for you to set in two clicks. If you'd rather I copy the Hub's rows exactly, the Hub's saved pairings can be exported to CSV and loaded instead — the app data in the Hub isn't readable from here, only its code.

## Technical notes

- Port from the Hub snapshot: `loan-consolidation.tsx` (tab layout), `loan-consolidation.index.tsx` (matrix + selectors + export buttons), `loan-consolidation.groups.tsx`, `loan-consolidation.admin.tsx` (accounts), plus the PDF/XLSX builders in `loan-consolidation.server.ts` and the export server fns (`downloadLoanReconciliationPdf` / `...Xlsx`).
- Routes here: `src/routes/_authenticated/firms.$firmId.loans.tsx` (layout with the three tabs) and `.index.tsx` / `.groups.tsx` / `.accounts.tsx` leaves. Delete `clients.$clientId.loans.tsx` and `clients.$clientId.loans-accounts.tsx`; redirect their paths to the new screen.
- Groups: keep Traction's `consolidation_groups` + `consolidation_group_members` (client-scoped) rather than the Hub's `loan_consolidation_groups.company_ids`; the Groups tab is the existing `ConsolidationGroupsSection` behaviour, moved into a tab. Resolve group → clients → tenant ids via `client_xero_orgs`.
- `loan_consolidation_accounts` already exists here with `client_id`, `tenant_id`, `counterparty_account_id` — no schema change needed for pairings. Add `ALL_FILES` handling and `listGroupTenantsWithLoans` equivalents to `src/lib/loan-consolidation.functions.ts`, keeping the existing `requireSupabaseAuth` + firm-membership gating (the Hub's `has_role('admin')` checks map to advisor / firm_owner / super_admin here).
- Migration: new `public.loan_consolidation_snapshots` (group_id → `consolidation_groups`, as_at, payload jsonb, generated_by, generated_at) with GRANTs for `authenticated` and `service_role` and RLS scoped to firm members, mirroring the Hub table.
- Reuse the existing `loan-recon.server.ts` / `loan-mismatch.server.ts` engines and `MismatchDetailDialog`; they already match the Hub's.
- Seeding runs as a one-off admin action against Xero, then rows are inserted with the insert tool — no seed data hardcoded in the app.
- Super admins keep the "no client data" rule: setup visible, figures hidden.
