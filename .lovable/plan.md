
# Xero File Audit

Build an advisor-only audit that scans a connected Xero org for common file-quality issues across four areas, surfaces a small summary on the dashboard, and a full drill-down page with deep links into Xero and snooze.

## What it checks (rules v1)

**Chart of accounts hygiene** (Xero `Accounts`)
- Duplicate account names (case-insensitive within same type)
- Bank/clearing/suspense accounts with non-zero balance ("Suspense", "Clearing", "Unallocated")
- Revenue / expense accounts with no tax rate set
- Archived accounts still holding a balance
- Accounts of type EXPENSE/REVENUE classified under EQUITY (or vice-versa)

**Bank & reconciliation** (`BankSummary`, `Accounts` + `BankTransactions`)
- Statement balance ≠ Xero balance per bank account
- Manual journals posted directly to a bank account (last 12 months)
- Bank accounts with no activity in last 90 days but non-zero balance

**AR / AP integrity** (`Invoices`, `CreditNotes`, `Contacts`)
- Negative AR / negative AP balances (credit on debtor, debit on creditor)
- Invoices/bills open > 120 days
- Unallocated credit notes / prepayments / overpayments
- Duplicate invoice numbers per contact
- Contacts with both AR and AP open balances (potential offset)

**Tax / GST / Payroll** (`Reports/TrialBalance`, `Reports/ActivityStatement`, `Accounts`)
- Income lines coded BAS Excluded / No GST
- Expense lines coded GST on Income (wrong direction)
- GST control account balance vs latest BAS 1A − 1B
- PAYG W / Super liability balance vs latest BAS W2 / W5
- Wages expense vs Super expense ratio outside 9–13%

Each rule returns: `{ id, category, severity, title, message, entityType, entityId, xeroDeepLink, evidence }`.

## Where it lives

- **Summary card** on advisory dashboard (`HealthPillars.tsx` area): counts by High/Med/Low + "Run audit" + "Open full report".
- **Full page**: `/clients/$clientId/audit/$tenantId` — filters by category & severity, snooze, "Open in Xero" deep link, last-run timestamp, re-run button.

## Technical

**New files**
- `src/lib/xero/audit/rules.server.ts` — pure rule functions over already-fetched Xero payloads (testable).
- `src/lib/xero/audit/runner.server.ts` — orchestrates Xero fetches, runs rules, dedupes against `audit_findings_snoozed`, persists run summary.
- `src/lib/xero/audit.functions.ts` — `runXeroAudit({ tenantId })`, `getLatestAudit({ tenantId })`, `snoozeFinding({ findingKey, until })`, `unsnoozeFinding(...)`. All `.middleware([requireSupabaseAuth])`, gated by `getConnectionByTenant` for tenant access + `has_role('advisor')`.
- `src/components/dashboard/AuditSummaryCard.tsx` — counts by severity, "last run", run/refresh button.
- `src/routes/_authenticated/clients.$clientId.audit.$tenantId.tsx` — full report page.
- `src/lib/xero/audit/deeplinks.ts` — builds `https://go.xero.com/...` URLs by entity type.

**DB migration** (one file, with GRANTs)
- `audit_runs(id, tenant_id, run_at, summary jsonb, run_by uuid)`
- `audit_findings(id, run_id, tenant_id, rule_id, severity, category, title, message, entity_type, entity_id, deep_link, evidence jsonb, finding_key text)` — `finding_key = hash(rule_id + entity_id)` for stable snooze identity.
- `audit_finding_snoozes(tenant_id, finding_key, snoozed_until, snoozed_by, note)`
- RLS: advisors with tenant access (`has_tenant_access`) can SELECT; INSERT via server functions using service role. GRANT block included for `authenticated` + `service_role`.

**Tier wiring**
- Add widget key `xero_audit` to `src/lib/tiers.ts` ALL_WIDGETS under Advisory; default ON for advisory tier in `tier_widget_config` seed.
- Render `AuditSummaryCard` in `clients.$clientId.index.tsx` only when widget enabled.

**Performance**
- Cache run results in DB (per tenant). Re-run is explicit; no auto-refresh on every page load.
- Fetch Xero reports in parallel inside the runner; reuse the existing `getConnectionByTenant` + `xeroGet`.

**Out of scope (v1)**
- Bulk fix / write-back to Xero (read-only).
- CSV/PDF export (can be added later).
- Scheduled background runs.

## Open questions to confirm before build

1. Confirm Australian-only tax rules (BAS / PAYG W / Super) — same assumption used by `TaxLiabilityWidget`.
2. Snooze duration options: 7 days, 30 days, "until data changes"? Default I'll use: 7 / 30 / 90 days + indefinite.
