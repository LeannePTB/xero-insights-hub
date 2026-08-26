# Diagnosis — is "off" actually off?

Read-only investigation. Nothing was changed.

## 1. Autotek NSW — the card is not turned off

- Client id: `55959877-2802-4d17-8853-719814972fbc` ("Autotek New South Wales Pty Ltd"), organisation `78abaf83-0129-48b1-bdf9-77c18aa2b2a3`.
- Tier: `advisory` (from `client_subscriptions`: `subscription_type = free_forever`, `status = active`, `dashboard_tier = advisory`, comp reason "Dashboard tier assigned by the organisation").
- `client_access`: no viewer rows at all — no client user has been invited yet.
- `tier_widget_config` rows touching this client:
  - organisation row, tier `advisory`: `widgets = {}`, `excluded_widgets = {cashflow, transaction_search, true_breakeven, accounting_breakeven}`
  - organisation row, tier `multi_company`: `excluded_widgets = {unreconciled}`
  - **no client-level row exists for this client**
  - platform default rows for `basic`/`advisory`/`multi_company`/`wip` all have `excluded_widgets = {}`
- Ceiling for `advisory` (`plan_levels.widgets`) includes `xero_audit`.

`client_allowed_widgets` and `client_can_use_widget` could not be executed directly (the read role is denied EXECUTE on them — expected), so the answer is derived from the function's own SQL, read from the catalogue: ceiling (advisory) − organisation exclusions − client exclusions. `xero_audit` is in the ceiling and appears in no exclusion list.

**Plainly: `xero_audit` is currently PERMITTED for Autotek NSW.** The card is rendering because it is switched on. Whoever turned it "off" either toggled it on a different tier row (the `multi_company` row is the only other one, and it only excludes `unreconciled`), or the toggle did not persist. The four things that *are* off for this client are cashflow, transaction search, true break-even and accounting break-even.

Worth noting: `true_breakeven` and `accounting_breakeven` are both excluded, and `cashflow` too — so the Advisory section for this client is thin, which may be why an unexpected audit card stands out.

## 2. Is the card gated at all?

`src/routes/_authenticated/clients.$clientId.index.tsx`:

- `AuditSummaryCard` — line 230, inside `if (widgets.includes("xero_audit"))`. Gated in the UI.
- `TransactionSearchWidget` — line 270, `widgets.includes("transaction_search") && orgSearchQ.data?.allowed`. Gated twice.
- `LoanConsolidationWidget` — line 264, `widgets.includes("loan_consolidation")`. Gated in the UI.

`widgets` comes from `getClientWidgets` (`src/lib/tier-config.functions.ts:441`), which calls `client_allowed_widgets` through the caller's own session. So the UI list is honest and single-sourced. The audit card is not the exception; it is simply enabled.

## 3. Per-widget gate audit

"Enforced on server" means the server function refuses when the widget is excluded for that client. "Reachable anyway" means data still comes back to a caller who invokes the server function directly while the card is hidden.

| Widget key | Hidden in UI | Enforced on server | Reachable anyway |
|---|---|---|---|
| health | yes | `assertWidgetAccess` (`health.functions.ts:425`) | yes for any organisation member — see note A |
| receivables | yes | `assertWidgetAccess` (`receivables.functions.ts:45,115`) | yes, note A |
| payables | yes | `assertWidgetAccess` (`payables.functions.ts:50,123`) | yes, note A |
| pnl | yes | `assertWidgetAccess(data.widget ?? "pnl")` (`reports.functions.ts:103`) | yes — **widget key is taken from the request body**, note B |
| tax_liability (Protected Money) | yes | `assertWidgetAccess("tax_liability")` (`reports.functions.ts:154,218,249,306,431`) | yes, note A |
| accounting_breakeven (merged) | yes | P&L half only, via the request-supplied widget key; `getTrueBreakevenInputs` (`true-breakeven.functions.ts:26`) has **no widget check** — RLS only | yes |
| cashflow | yes | `assertWidgetAccess("cashflow")` (`cashflow.functions.ts:138`) | yes, note A |
| cashflow_scenario | yes | `assertWidgetAccess("cashflow_scenario")` (`scenario.functions.ts:212`) | yes, note A |
| balance_sheet_reconciliation | yes | `assertClientWidget` via `recon-snapshot.server.ts:33` | no for viewers; yes for staff, note A |
| fixed_assets_reconciliation | yes (+ capability) | same path | as above |
| gst_reconciliation | yes (+ capability) | same path | as above |
| **xero_audit** | yes | **no widget check at all** — `audit.functions.ts` only calls `assertAdvisor` (global `advisor`/`super_admin` role) then `getConnectionByTenant(tenantId)` | **yes — see note C, the worst one** |
| transaction_search | yes | full: client access, organisation staff, `assertClientWidget` (`search.functions.ts:139-146`) | no |
| loan_consolidation | yes | `clientCanUseWidget` / `firmCanUseWidget` (`loan-consolidation.functions.ts:146`, `consolidations.functions.ts:36`, `consolidation-groups.functions.ts:49`, `consolidated.functions.ts:74`) | no |
| unreconciled | yes | no widget check — RLS on `unreconciled_lines` only | yes |
| notes | yes | no widget check — RLS on `client_notes` only | yes |
| file capability profile | n/a | `getEffectiveTier` access check only (`file-capability.functions.ts`) | reads snapshots the caller can already read |

**Note A — the structural one.** `assertWidgetAccess` (`src/lib/xero/access.server.ts:100`) returns early for anyone `getEffectiveTier` calls an advisor, and *every active member of the organisation* is an advisor there (`isAdvisor: true, tier: "investigate"`), as is a super admin with an approved support grant. So for staff, widget exclusions are a UI preference, not a control. For an invited client viewer they are enforced. That is a defensible design, but it is not what "turned off" sounds like.

**Note B — client-chosen widget key.** `getProfitAndLoss` authorises against `data.widget`, supplied by the caller. A viewer who has `accounting_breakeven` but not `pnl` can pass `widget: "accounting_breakeven"` and receive the full profit and loss. The check is real but the caller picks which lock to test.

**Note C — the audit card.** `getLatestAudit` / `runXeroAudit` / `snoozeFinding` / `resolveFinding` / `unsnoozeFinding` check only that the caller holds a platform-wide `advisor` or `super_admin` role, then resolve the tenant with `getConnectionByTenant` (`api.server.ts:223`), which looks up `xero_connections` by `tenant_id` through `supabaseAdmin` with **no organisation scoping**. There is no `assertWidgetAccess`, no `platformStaffCanAccessFirm`, no membership check. Any holder of the `advisor` role can read — and re-run, writing rows and burning Xero calls — the audit of any tenant in the platform by tenant id. This breaches invariants 3 and 4 in section 0 of the Access Control Spec: a bare role is being treated as a grant, and a `tenantId` from the request body is acting as one.

## 4. Does "off" mean one thing?

Four ways a card can be off, and they do **not** converge:

1. **Not in the tier's plan ceiling** (`plan_levels.widgets`) — enforced in the database function, so it reaches every consumer that calls it.
2. **In `excluded_widgets`** at organisation or client level — same function, same reach. Organisation row *replaces* the platform row (precedence, not union); client row is added on top. `src/lib/widget-resolve.server.ts` reimplements this in TypeScript for the admin screens; it currently matches the SQL, but it is a second copy of a rule the spec says must have one implementation.
3. **Per-client disable** — this is just (2) with a client-level row. No separate mechanism.
4. **Capability profile** — `src/lib/xero/file-capability.server.ts`, presentation only, applied in the route at lines 259 and 261.

The divergence is not in how "off" is computed — it is in **who honours it**. `client_allowed_widgets` is honoured by the UI list, by `assertClientWidget` (search, reconciliations, loan consolidation), and by `assertWidgetAccess` **for viewers only**. It is honoured by nothing at all for `xero_audit`, `unreconciled`, `notes` and the true-break-even inputs.

**Capability gating cannot make a card appear.** `hiddenWidgets` only ever populates `gst_reconciliation` and `fixed_assets_reconciliation`, and it is only ever consumed as `widgets.includes(x) && !structurallyHidden(...)`. It subtracts; it can never add. An `unknown` profile yields an empty `hiddenWidgets`, so it shows. It is not why the audit card is on.

## 5. Client-facing vs staff

- **Client viewer** (`client_access` row): sees only widgets in `client_allowed_widgets`, and `assertWidgetAccess` enforces that server-side. Cannot use transaction search (organisation-staff check rejects them). Cannot reach the audit functions (`assertAdvisor` rejects them). Two real gaps for viewers: the P&L widget-key substitution (note B), and `getTrueBreakevenInputs` / notes / unreconciled, which are RLS-scoped but not widget-scoped — a viewer with a row-level path to a client can read those regardless of the card being off. Autotek has no viewers today, so nothing is exposed there right now.
- **Organisation staff (e.g. DRTABT)**: full `investigate` tier over their own organisation's clients regardless of any exclusion. Correct on access; misleading on "off".
- **Traction Advisory staff**: reach a client organisation via membership (Path A) or an approved support grant (Path B) for the Xero-data functions. **Except the audit functions**, which need neither — a platform role alone is enough for any tenant. That is the one place where Path C metadata privilege leaks into Xero financial data.

Transaction search's "organisation staff only" claim **is** enforced server-side, in this order: `assertClientDataAccessForClient` → `firmIdForClient` → `assertOrganisationStaff` → `assertClientWidget`. It is the model the rest should follow.

## Recommended fixes, in order (nothing implemented)

1. **`src/lib/xero/audit.functions.ts`** — replace `assertAdvisor` with the search pattern: resolve the client and organisation from the tenant server-side, `assertClientDataAccessForClient` / `platformStaffCanAccessFirm`, then `assertClientWidget(..., "xero_audit")`. Apply to all five exported functions.
2. **`src/lib/xero/reports.functions.ts:103`** — stop authorising against a caller-supplied widget key. Check `pnl`, or check that the caller holds *all* of the keys the P&L can serve.
3. **Decide and document what "off" means for staff.** Either `assertWidgetAccess` stops exempting advisors, or the settings copy says plainly that switching a card off hides it from the client dashboard and does not restrict organisation staff. The current wording implies the former; the code does the latter.
4. **Add `assertClientWidget`** to `getTrueBreakevenInputs`/`upsertTrueBreakevenInputs`, the unreconciled functions and the notes reads, so RLS is not the only gate on a card that is switched off.
5. **Collapse the duplicate resolution.** `widget-resolve.server.ts` should call the database function rather than re-derive the ceiling−exclusions maths, per spec section 0.7.
6. **Autotek NSW specifically** — no code fix needed. If the audit card should be off, add `xero_audit` to the client-level exclusion row for tier `advisory`; there is currently no client row at all.

## Unrelated build blocker spotted

`src/routes/_authenticated/clients.$clientId.index.tsx:23` imports `BreakevenWidget` from `@/components/dashboard/BreakevenWidget`, but that file only exports `AccountingBreakevenWidget`. The build fails on it. One-line fix (rename the import or add the export alias), but it is a code change, so it is listed here rather than made — say the word and I will apply it.
