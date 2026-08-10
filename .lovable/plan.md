# Port Company Loan Consolidation from Business Hub Central

## Goal

Copy the **Company Loan Consolidation** app from the **Business Hub Central** project into this Traction Advisory project, wired the same way as the tier widgets so it can be enabled / offered per client.

## Key design decision: a Client is the consolidation "group"

The source app groups Xero companies into a **CRM group** (tables `crm_groups`, `crm_company_group_memberships`, `crm_companies`, `xero_company_connection`). This project has **no CRM** — its model is `Firm → Client → linked Xero organisations` (`clients`, `client_xero_orgs`, `xero_connections`).

So the loan tool runs **per client**: it reconciles loan accounts across all Xero organisations linked to that client (the `multi_company` tier is what allows >1 linked org). Advisors/firm staff pair accounts in the **Accounts** tab; a viewer with the widget enabled sees the **Matrix**. No CRM / groups tables are copied.

## What gets ported

### Database (one new table)
Create `public.loan_consolidation_accounts` (same shape as the source, keyed to a client instead of a group):

```
id uuid pk
client_id uuid not null → clients(id) on delete cascade
tenant_id text not null
account_id text not null
account_code text null
account_name text not null
account_type text null
counterparty_account_id uuid null
direction text not null          -- 'payable' | 'receivable'
sort_order integer not null
created_at / updated_at
```

Same migration must add `GRANT`s (`authenticated`, `service_role`), enable RLS, and add policies: a firm member/advisor of the client's firm can read + manage; a `client_access` viewer whose tier includes `loan_consolidation` can read. No `loan_consolidation_groups` / CRM tables are needed.

### Tier wiring (this project's widget system)
- Add `loan_consolidation` to `src/lib/tiers.ts`: the `WidgetKey` union, `ALL_WIDGETS`, `WIDGET_LABEL` ("Loan Consolidation"), and `DEFAULT_TIER_WIDGETS` (add to `advisory` and `multi_company`).
- This automatically makes it controllable via the existing tier-widget admin (global + per-client overrides, `getEffectiveWidgets`), and gateable server-side with the existing `assertWidgetAccess(userId, tenantId, "loan_consolidation")`.

### Routes (client-scoped, full app = Matrix + Accounts)
- `src/routes/_authenticated/clients.$clientId.loans.tsx` — **Matrix**: pick a Xero org / "all", choose As-at date, render the consolidated loan matrix with balanced/mismatch/unpaired status and row-level mismatch drill-down.
- `src/routes/_authenticated/clients.$clientId.loans-accounts.tsx` — **Accounts** admin: list each linked org's active Liability/Asset accounts and pair them (advisor / firm staff only).
- A tab/entry on the client dashboard linking to these, rendered only when the client's effective tier includes `loan_consolidation`.

### Server modules (ported + adapted to this Xero layer)
- `src/lib/loan-consolidation.functions.ts` — server fns: `listClientTenants`, `listSelectedAccounts`, `listLiabilityAccountsForTenant`, `savePairing`, `deletePairing`, `getLoanConsolidationMatrix`, `getLoanMismatchDetail`. Admin checks use this project's role model (`getMyContext().hasAdminAreaAccess`) instead of the source's `assertAdmin`.
- `src/lib/loan-recon.server.ts` — reconciliation engine. Adapts from group/`xero_company_connection` to client/`client_xero_orgs`+`xero_connections`.
- `src/lib/loan-mismatch.server.ts` — transaction-level mismatch pairing engine (drill-down).
- `src/lib/loan-consolidation.server.ts` — PDF/Excel exports + snapshots (only if present in the source; confirm at port time).
- `src/lib/xero-account-link.ts` — Xero deep links (mirrors the deep-link helper already used by receivables).

### Xero access layer (reuse, don't copy)
Replace the source's `xero.server.ts` / `bills-search.server.ts` (`ensureFreshTokens`, `listAllAccounts`, account-transactions report) with this project's established `src/lib/xero/api.server.ts` — `getConnectionByTenant(tenantId)` + `xeroGet(conn, path, params)` (already handles token refresh, 429/401 retry, and scope hints). Loan-account balances are fetched per tenant through `xeroGet` (the exact report/endpoint — `Reports/AccountTransactions` vs `Accounts` list — is confirmed at port time against the source's `loan-recon.server.ts`).

### Component
- `src/components/loan/MismatchDetailDialog.tsx` — drill-down dialog for a mismatched row.

## What is intentionally NOT copied
- CRM tables and the Groups admin (client replaces the group concept).
- Any other Business Hub Central modules (only the loan files above).

## Dependencies / guardrails
- **No new npm packages** — the recon engine and exports are pure TS.
- Follow the TanStack Start rules already enforced here: `*.server.ts` imported only dynamically from `*.functions.ts` handlers; server fns stay thin; the two new routes auto-register (do not touch `routeTree.gen.ts`).
- Use `assertWidgetAccess(..., "loan_consolidation")` so viewers can't call the matrix/accounts fns without the widget.
- Migration tool for the schema (GRANTs + RLS in the same migration).

## Verification
- Typecheck + build pass.
- Playwright check: open a client dashboard with `loan_consolidation` enabled, open the Loan Consolidation Matrix, and confirm the tab/admin gate behaves for an advisor vs a viewer.

## Open items confirmed during implementation
- Exact Xero report/endpoint the recon engine uses for loan-account balances, and whether the source has export/snapshot server code worth porting.
- Whether you also want a cross-client grouping admin later (out of scope for this pass — clients are the grouping unit).
