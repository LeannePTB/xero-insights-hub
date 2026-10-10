# System Admin organisations redesign and no-amber palette

Classification: **SECURITY-RELEVANT presentation change**. The screens contain billing, member-support, support-access, audit and Preview As controls. This plan changes their layout and routing state only: every existing server function, AAL2 check, database authorisation check, RLS policy, grant and audit write stays in place.

## Decisions

- Use a **single compact table** for super admins, with stacked rows below the desktop breakpoint.
- Use URL-backed tabs on the existing organisation-detail route: `/system/organisations/:firmId?tab=overview|plan|billing|members|xero|support|audit`. This gives deep links and browser history without adding seven route files or changing a guard.
- Keep **Preview as owner**, but only in Support. It remains useful for a handed-over organisation where self-joining is correctly refused: with an approved support grant, it shows the customer-shaped presentation without creating membership. It does not grant access; `record_view_as` still requires AAL2, super admin and an existing membership or active support grant. The action will be hidden/disabled when that prerequisite is absent.
- Keep the database status word `warn` where monitoring returns it, but render it with the new soft-blue note treatment. Only an `action`/genuine failure is red.
- **No database change proposed.** The current reads already supply the organisation summary, purchase/trial state, usage, billing mode, created date, owner/member metadata, Xero-file metadata, support state and audit rows needed here.

## Sketch

```text
Organisations                                      [Add organisation]
Plan and usage metadata only — no client figures.

[ Search organisations… ]  [All] [Trialling] [Needs attention] [Lapsed / overdue]

Organisation       Clients  Advisory  Consolidation  Branding  Billing      Trial ends  Attention
Bangkok on King     1 / 1      ✓           —            ✓      Bookkeeping               —
Example Co [Trial]  9 / ∞      ✓ trial     ✓ trial      —      External     14 Nov 2026   ⚑ 1
└─ whole row opens the organisation; column headings sort
```

```text
‹ Organisations        Organisation name                     [abnormal status only]

[Overview] [Plan & options] [Billing] [Members] [Xero files] [Support] [Audit log]

Overview
Organisation name  [Edit]
Status              Active
Clients             1 / 1
Created             10 August 2026
Owner               Name + verified email
Quick facts         Bookkeeping · Advisory on · Branding on
```

On small screens, each organisation becomes one tappable stacked card with the same fields; the detail tabs become a compact horizontally scrollable tab strip.

## 1. Organisations list

- Replace the current three-column summary and row actions with: Organisation, Clients, Advisory, Consolidation, Branding, Billing, Trial ends and Needs attention.
- Organisation status pills appear only for abnormal/special states: Trial, Lapsed, Past due, Cancelled, Suspended or Always free. Bad lifecycle states are red; Trial is soft blue; Always free is neutral.
- Clients displays `used / limit`, using `∞` for the unlimited sentinel. **At limit is plain text. Over limit alone is red.**
- Option cells use a semantic green tick or muted dash. Trialled availability adds small blue-muted `trial` text.
- Needs attention initially counts the already-returned clients missing GST or PAYG lodgement cycles. The icon tooltip spells out the count; zero is a muted dash. No client figures are fetched or shown.
- Add case-insensitive name search; All, Trialling, Needs attention and Lapsed / overdue filters; and accessible sorting for Organisation, Clients, Billing, Trial ends and Needs attention. Search, filters and sorting are client-side presentation over the already authorised rows.
- The entire row/card opens `/system/organisations/:firmId`; keyboard users can open it with Enter/Space. Remove Options & members, Clients and View As from every row.
- Keep Add organisation top right and shorten the explanatory line to `Plan and usage metadata only — no client figures.`
- Preserve the existing non-super platform-staff fallback: it only receives membership-derived organisations and cannot open the super-admin detail route. Its rows open the relevant organisation workspace instead. This avoids widening the current guard merely to make both tables identical.

## 2. Organisation detail

- Add a reusable tab navigation component and split the existing long page into seven mounted-on-demand panels while keeping one page title.
- **Overview:** editable name through the existing audited admin rename function; database-resolved lifecycle status; clients used/limit; created date; owner matched from the returned member list; billing mode and effective purchased/trialled options as quick facts.
- **Plan & options:** the existing `OrgPurchaseCard`, unchanged write path and entitlements.
- **Billing:** the existing `BillingLifecycleCard`, unchanged super-admin and audited write paths.
- **Members:** current member list, invite, reset email, set password and change email tools. Their existing server guards and audit writes remain unchanged.
- **Xero files:** add a metadata-only mode to `FirmXeroFilesCard` for this System Admin tab. Show file name, connection state and missing-permission metadata; hide reconnect controls here. The organisation workspace retains its existing reconnect controls.
- **Support:** support-access status and history, Add me as staff/Leave, plus one low-key Preview as owner action. Self-membership remains the audited database operation and support access remains read-only.
- **Audit log:** move the current grouped audit list into its own tab and only request it when that tab is active.
- Show no balances, dashboard values, reports, transactions, payroll figures or other client figures in any tab.

## 3. Preview As inventory and outcome

Keep these active pieces:

- `src/lib/view-as.functions.ts` — guarded/audited call to `public.record_view_as`.
- `public.record_view_as` and its audit rows — still used by the Support-tab action.
- `src/components/admin/ViewAsBanner.tsx` and the existing `viewAs=owner` presentation handling in organisation/client pages.

Remove only the Organisations-list launcher. Restyle the preview banner from amber to the semantic blue note treatment. No function, record type, policy or grant becomes unused under this proposal.

## 4. Site-wide colour tidy

Define and use semantic tokens instead of raw warm colour utilities:

- `muted`: ordinary information and at-limit text.
- `primary`: brand emphasis.
- `info`: soft blue for trials, notes, pending/incomplete states, stale-data notices, needs-attention prompts and monitoring Warn.
- `success`: green for enabled/healthy/connected.
- `destructive`: red only for genuinely bad states such as lapsed, overdue, cancelled, suspended, over limit, disconnected/missing required Xero permission, materially incomplete data and Security Action.

Implementation:

- Add light/dark `info` tokens in `src/styles.css`; expose semantic badge variants for info and success.
- Remove gold/amber from `accent`, dark-mode primary, chart colours and the unused gold gradient so the global palette itself contains no warm warning colour.
- Replace every `amber-*`, `orange-*` and `yellow-*` visual utility in `src/`; replace the one hard-coded amber chart colour; replace warning-coloured toast calls with neutral/info messaging or destructive errors according to impact.
- Map intermediate health/watch states to info blue, healthy to green and bad to red. This is colour-only: no score threshold, health result, posture result or Xero rate-limit severity changes.
- Security cards: OK green, Warn blue, Action red. Xero request allowance: ordinary/self-recovering dips blue, day allowance below 5% red. “Paused by Xero” follows the existing severity rather than always appearing red.
- Update design memory: replace the old amber-Warn preference with the approved neutral/blue/green/red semantics and add the full semantic colour-token reference.

## Files to change

### Organisation list/detail and shared controls

- `src/routes/_authenticated/system.index.tsx`
- `src/routes/_authenticated/system.organisations.$firmId.tsx`
- `src/components/admin/SystemOrganisationTabs.tsx` (new)
- `src/components/admin/OrgPurchaseCard.tsx`
- `src/components/admin/BillingLifecycleCard.tsx`
- `src/components/admin/FirmXeroFilesCard.tsx`
- `src/components/admin/ViewAsBanner.tsx`
- `src/components/ui/badge.tsx`
- `src/styles.css`
- `src/lib/system-organisations.ts` and `src/lib/system-organisations.test.ts` (new pure search/filter/sort/status model)

### Remaining warm-colour presentation inventory

- Admin/system: `AuditMonitoringCard.tsx`, `ConsolidationGroupsSection.tsx`, `FirmClientsSection.tsx`, `SecurityPostureCard.tsx`, `SecurityStatusCard.tsx`, `XeroUsageCard.tsx`, `system.staff.tsx`, `system.security.tsx`.
- Client/setup: `ClientSetupSection.tsx`, `XeroSyncStatusCard.tsx`, `clients.$clientId.index.tsx`, `clients.$clientId.settings.tsx`, `clients.$clientId.reports.tsx`, `clients.$clientId.audit.$tenantId.tsx`, `clients.$clientId.loans.tsx`.
- Dashboard/overview: `AuditSummaryCard.tsx`, `BreakevenWidget.tsx`, `CardFreshness.tsx`, `CashFlowRecommendations.tsx`, `ClientHealthBadge.tsx`, `ClientTrialNotice.tsx`, `CostClassificationPanel.tsx`, `DataSourceLine.tsx`, `EfficiencyRecommendations.tsx`, `GstReconciliationWidget.tsx`, `HealthScoreDonut.tsx`, `HealthWidget.tsx`, `LiveDot.tsx`, `MoneyRecommendations.tsx`, `PaygWithholdingWidget.tsx`, `PillarCard.tsx`, `ReconAgeNotice.tsx`, `RentReportWidget.tsx`, `StabilityRecommendations.tsx`, `SuperannuationWidget.tsx`, `TransactionSearchWidget.tsx`, `UnclassifiedNotice.tsx`, `dashboard/health/PillarCard.tsx`, `dashboard/health/StatusPill.tsx`, `OverviewView.tsx`.
- Organisation/loan screens: `firms.$firmId.loans.groups.tsx`, `firms.$firmId.loans.index.tsx`, `ConsolidationGroupsSection.tsx`.
- Shared plan styling: `src/lib/firmPlans.ts`.
- Project records: `docs/security-backlog.md` (record this reviewed presentation change), `roadmap.md`, and design memory (`mem://design/severity-semantics`, new `mem://design/color-tokens`, `mem://index.md`).

The implementation pass will re-run the inventory and include any newly found warm visual utility in this same scope; historical prose in security documents is not rewritten merely because it records an earlier amber design.

## Security preservation and verification

- No route guard, server function guard, database function, RLS policy, grant, support rule, membership rule, billing rule or Preview As prerequisite changes.
- Caller-supplied organisation IDs remain filters only. Super admin alone still grants no client-data access.
- `OrgPurchaseCard`, billing changes, member support actions, self-membership and Preview As continue through their existing AAL2-protected and audited paths.
- Update the security backlog with a closed presentation-only entry; the access matrix and definer register do not change because no access expectation or function changes.
- Verify pure list filtering/sorting tests, navigation tests, relevant existing UI logic tests, `bunx tsgo`, build, `bun run security:check`, live security posture and the database linter.
- Browser-check desktop and mobile: search/filter/sort, whole-row navigation, every detail tab, metadata-only Xero tab, Support-tab Preview As visibility, no client figures, and no remaining orange/amber/yellow visual styling.

## Not changed

- No database migration or stored data rewrite.
- No entitlement, billing, trial, membership, support, Xero or audit business logic.
- No removal of Preview As or its audit history.