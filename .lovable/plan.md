# Per-client fixed/variable cost classification

Let advisors tag each Xero expense account as **Fixed** or **Variable** per client. The breakeven widget uses those tags instead of treating all operating expenses as fixed.

## How it will work for you

1. Open a client → Settings → new **"Cost classification"** section, one panel per linked Xero org.
2. Each panel lists every expense account that has appeared in that org's P&L (last 12 months), with a Fixed / Variable toggle. Default = Fixed (matches today's behaviour, so nothing breaks until you classify).
3. Save. Breakeven recalculates immediately.

The breakeven card then shows:
- **Fixed Costs / mo** = sum of accounts tagged Fixed ÷ months
- **Variable Costs / mo** = sum of Cost of Sales + accounts tagged Variable ÷ months
- **Gross Margin** = (Revenue − all variable costs) ÷ Revenue
- A small "X of Y accounts classified" hint with a link back to settings if any are still unclassified.

## Changes

### 1. Database — new `client_cost_classifications` table
Columns: `client_id`, `tenant_id`, `account_name` (text, the line label from Xero's P&L), `classification` ('fixed' | 'variable'), timestamps. Unique on (client_id, tenant_id, account_name). RLS: advisors on the client's firm can read/write; viewers read-only. Full GRANTs as per project rules.

We key on **account name** (not account code) because that's what the P&L report already returns to us — no extra Xero API call needed. If two accounts share a name across orgs, the tenant_id scope keeps them separate.

### 2. Server functions — `src/lib/cost-classification.functions.ts` (new)
- `listCostClassifications({ clientId, tenantId })` → existing tags + the list of accounts seen in the last 12 months of P&L (via existing `getProfitAndLoss` parser, which already returns `expenseLines`).
- `setCostClassification({ clientId, tenantId, accountName, classification })` → upsert.
- `bulkSetCostClassifications({ clientId, tenantId, entries[] })` → save the whole panel at once.

### 3. Breakeven server logic
Extend `getProfitAndLoss` (or add a thin wrapper `getBreakevenInputs`) to also return the per-account expense breakdown (already parsed into `expenseLines`). The widget then loads the client's classification map and splits opex into fixed vs variable on the client side. No change to Xero report calls.

### 4. UI changes
- **`clients.$clientId.settings.tsx`** — add "Cost classification" Section per Xero org, with the toggle list and a Save button. Show a "Refresh accounts" button that re-pulls the last-12-mo P&L to discover any new accounts.
- **`BreakevenWidget.tsx`** — fetch the classification map, recompute fixed vs variable, update the KPIs and footnote. Show an inline warning when N accounts are unclassified (treated as fixed by default) with a link to settings.

### 5. Migration & defaults
- New table only. No data migration — existing clients start with everything implicitly Fixed, which matches current behaviour.
- A small banner on the breakeven card prompts the advisor to classify accounts the first time it sees unclassified ones.

## Out of scope
- No changes to Xero (no account code conventions required).
- No bulk import/export of classifications (can add later if useful).
- Cost of Sales stays 100% variable — that's the standard treatment and Xero already separates it in the P&L.
