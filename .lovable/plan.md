# Multi-company consolidated dashboard plan

## Goal
Add a consolidation option for multi-company subscriptions. Advisors can choose which Xero organisations to consolidate; the client dashboard then shows individual companies AND a consolidated view side-by-side, with intercompany loan balances eliminated using the existing loan consolidation pairings.

## What we will build

1. **Consolidation settings on each client**  
   - Add `consolidation_mode` and `consolidation_org_ids` fields to `public.clients` (already applied).  
   - Update `getClient` to return the new fields.  
   - Add a `saveClientConsolidation` server function that validates the user is an advisor or firm owner.  
   - Add a `ConsolidationPanel` in the client settings page to toggle consolidation and select which organisations to include.  
   - Gate the panel so it only appears when the client has a multi-company plan (`max_xero_orgs > 1`).

2. **Consolidated AR/AP cards**  
   - Create `getConsolidatedAgeing` server function in `src/lib/xero/consolidated.functions.ts` that:  
     - Accepts a list of `tenantIds` and the client id.  
     - Fetches AR/AP ageing for each tenant using the existing Xero functions.  
     - Aggregates the buckets, totals, and top customers/suppliers.  
     - Reads the `loan_consolidation_accounts` pairings and subtracts the paired balances from the consolidated totals so intercompany loans are eliminated.  
   - Create `ConsolidatedReceivablesWidget` and `ConsolidatedPayablesWidget` that show the combined totals plus a per-company breakdown.

3. **Dashboard layout changes**  
   - In `src/routes/_authenticated/clients.$clientId.index.tsx`:  
     - Read `consolidation_mode` and `consolidation_org_ids`.  
     - Build the selected-org list from the client's `client_xero_orgs`.  
     - Show individual AR/AP cards for organisations that are **not** selected for consolidation.  
     - Show consolidated AR/AP cards for the selected group when the mode is `consolidated`.  
     - Keep all other widgets (P&L, tax, breakeven, etc.) per individual organisation.  
     - Add a small badge or label so users can see which view is individual vs consolidated.

4. **Loan consolidation**  
   - The existing `LoanConsolidationWidget` remains client-wide.  
   - The consolidated ageing will use the same `loan_consolidation_accounts` pairings to eliminate intercompany balances.

## What the user sees
- On each multi-company client, an advisor opens Settings, enables "Consolidated view", and ticks the companies to combine.  
- On the dashboard, un-ticked companies still show their own AR/AP cards.  
- Ticked companies get a single consolidated AR/AP card that adds their balances and removes intercompany loans.  
- All companies are still listed individually at the top of the page so the advisor can see every file.

## Technical details
- Reuse existing `getAgedReceivables` / `getAgedPayables` to fetch data for each tenant.  
- Use the existing `loan_consolidation_accounts` table and `runLoanReconciliation` logic to identify paired balances.  
- Store the selected org ids as `client_xero_orgs.id` UUIDs in `consolidation_org_ids` for stable references.  
- `consolidation_mode` defaults to `individual` so current behaviour is unchanged until an advisor turns it on.
