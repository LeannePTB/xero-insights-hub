# Brand refresh handover

Presentation only: no guards, grants, policies, entitlement or financial calculations changed.

## Palette and contrast

Royal primary #054492, navy #002A5F, blue links/rings #005CAB; categorical cyan, sky, mid, royal, navy, grey. Green healthy and red bad states remain semantic. No warm warning colours. Small-text logo grey #939598 fails AA: use #62666C (light) / #AEB6C1 (dark). White on cyan/sky also fails: cyan uses navy; navy on sky is only 4.02:1, so sky is reserved for decorative/chart elements, not small-text backgrounds. Dark inline emphasis uses #85CFF5 rather than dark royal. 27 contrast assertions verify shared foreground/background pairs.

## Typography and exceptions

App titles 18px; sections/cards 16/14px; body/tables 12px; helpers 11px minimum. Dashboard exceptions (24px maximum): health-score donut number and Overview status-bucket counts. Buttons and inputs minimum 32px. PDF headings capped at 13.5pt (18px equivalent), section headings 12pt. Existing smaller PDF table/footer text (6.5–10pt) is intentionally unchanged to preserve readability and pagination; not reduced. Draft watermark now respects the heading cap. Email titles/code 18px; body 12px.

## Logo and remaining work

Platform uploads already flow through the branding readers into sidebar/header/auth/viewer surfaces. Separate logo-adjacent wordmark removed. Headers use 36px height; collapsed sidebar clips the left mark without stretching. Reports preserve organisation report logo → platform logo → bundled fallback, with optional client logo secondary; intrinsic image dimensions avoid distortion. Existing immutable final/sent PDFs are not rewritten.

Public platform email logos now use the uploaded image with bundled data-image fallback. Some mail clients block inline data images: cross-client email visual verification remains unfinished. Private organisation email logos remain deferred/name-only; no logos were made public. Owner must still upload the new logo and replace the bundled PNG. Authenticated visual verification remains MFA-blocked.

## Verification

Navigation/landing: 15 passed. Monthly-report period tests: 3 passed (Bun runner). Contrast/email tests: 29 passed. Final full security run: 159 tests and 18 live-access tests passed; schema fingerprints, RPCs, catalogue, guards and definer register passed. Initial contrast test exposed navy-on-sky failure, addressed by restricting sky to decorative use. Initial report-test invocation used Vitest for a node:test suite; corrected to Bun, passing.

Typecheck/build are run automatically by the platform harness, not launched manually; final results must be taken from that run. Prior build log predates this refresh and is not evidence for these changes.

## Files changed

- `AGENTS.md`
- `docs/design/brand-refresh.md`
- `roadmap.md`
- `src/components/AppHeader.tsx`
- `src/components/BrandMark.tsx`
- `src/components/PageHeader.tsx`
- `src/components/admin/AuditMonitoringCard.tsx`
- `src/components/admin/ConsolidationGroupsSection.tsx`
- `src/components/admin/FirmClientsSection.tsx`
- `src/components/admin/OrgPurchaseCard.tsx`
- `src/components/admin/SecurityPostureCard.tsx`
- `src/components/admin/SecurityStatusCard.tsx`
- `src/components/admin/SupportAccessCard.tsx`
- `src/components/admin/TransferOwnershipCard.tsx`
- `src/components/admin/XeroErrorBreakdownCard.tsx`
- `src/components/admin/XeroUsageCard.tsx`
- `src/components/auth/MfaGate.tsx`
- `src/components/clients/ClientSettingsPage.tsx`
- `src/components/clients/ClientSetupSection.tsx`
- `src/components/clients/ViewerClientNav.tsx`
- `src/components/dashboard/AuditSummaryCard.tsx`
- `src/components/dashboard/BasisBadge.tsx`
- `src/components/dashboard/BasisSelect.tsx`
- `src/components/dashboard/BreakevenWidget.tsx`
- `src/components/dashboard/CardFreshness.tsx`
- `src/components/dashboard/CashflowWidget.tsx`
- `src/components/dashboard/ClientHealthBadge.tsx`
- `src/components/dashboard/ConsolidatedAgeingWidget.tsx`
- `src/components/dashboard/CostBasisControls.tsx`
- `src/components/dashboard/CostClassificationPanel.tsx`
- `src/components/dashboard/DataSourceLine.tsx`
- `src/components/dashboard/DateRangeControls.tsx`
- `src/components/dashboard/GstReconciliationWidget.tsx`
- `src/components/dashboard/HealthScoreDonut.tsx`
- `src/components/dashboard/HealthWidget.tsx`
- `src/components/dashboard/LiveDot.tsx`
- `src/components/dashboard/LoanConsolidationWidget.tsx`
- `src/components/dashboard/MonthPicker.tsx`
- `src/components/dashboard/NotesCard.tsx`
- `src/components/dashboard/PayablesWidget.tsx`
- `src/components/dashboard/PaygWithholdingWidget.tsx`
- `src/components/dashboard/PillarCard.tsx`
- `src/components/dashboard/PnlWidget.tsx`
- `src/components/dashboard/ReceivablesWidget.tsx`
- `src/components/dashboard/ReconAgeNotice.tsx`
- `src/components/dashboard/RentReportWidget.tsx`
- `src/components/dashboard/ScenarioWidget.tsx`
- `src/components/dashboard/SuperannuationWidget.tsx`
- `src/components/dashboard/TaxObligationsWidget.tsx`
- `src/components/dashboard/TransactionSearchWidget.tsx`
- `src/components/dashboard/UpgradeOptions.tsx`
- `src/components/dashboard/XeroActivityWidget.tsx`
- `src/components/dashboard/health/PillarCard.tsx`
- `src/components/dashboard/health/StatusPill.tsx`
- `src/components/firm/FirmPageHeader.tsx`
- `src/components/overview/OverviewView.tsx`
- `src/components/people/ViewerInviteForm.tsx`
- `src/components/reports/MonthlyReportPreview.tsx`
- `src/components/reports/ReportVerdictPage.tsx`
- `src/components/shell/AppSidebar.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/xero/ConnectWithXeroButton.tsx`
- `src/lib/email-templates/EmailLogo.tsx`
- `src/lib/email-templates/email-change.tsx`
- `src/lib/email-templates/firm-invite.tsx`
- `src/lib/email-templates/invite.tsx`
- `src/lib/email-templates/magic-link.tsx`
- `src/lib/email-templates/reauthentication.tsx`
- `src/lib/email-templates/recovery.tsx`
- `src/lib/email-templates/report-ready.tsx`
- `src/lib/email-templates/signup.tsx`
- `src/lib/email/send.server.ts`
- `src/lib/error-page.ts`
- `src/lib/loan-consolidation-export.server.ts`
- `src/lib/presentation-tokens.ts`
- `src/lib/reports/report-pdf.server.ts`
- `src/lib/xero-assessment-pdf.ts`
- `src/routes/__root.tsx`
- `src/routes/_authenticated/clients.$clientId.cashflow-scenario.tsx`
- `src/routes/_authenticated/clients.$clientId.index.tsx`
- `src/routes/_authenticated/clients.$clientId.loans-accounts.tsx`
- `src/routes/_authenticated/clients.$clientId.loans.tsx`
- `src/routes/_authenticated/clients.$clientId.payables.$tenantId.tsx`
- `src/routes/_authenticated/clients.$clientId.receivables.$tenantId.tsx`
- `src/routes/_authenticated/clients.$clientId.reports.tsx`
- `src/routes/_authenticated/clients.new.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/firms.$firmId.consolidated.$groupId.tsx`
- `src/routes/_authenticated/firms.$firmId.consolidations.tsx`
- `src/routes/_authenticated/firms.$firmId.index.tsx`
- `src/routes/_authenticated/firms.$firmId.loans.accounts.tsx`
- `src/routes/_authenticated/firms.$firmId.loans.groups.tsx`
- `src/routes/_authenticated/firms.$firmId.loans.index.tsx`
- `src/routes/_authenticated/firms.$firmId.loans.tsx`
- `src/routes/_authenticated/settings.account.tsx`
- `src/routes/_authenticated/settings.activity.tsx`
- `src/routes/_authenticated/system.security.tsx`
- `src/routes/_authenticated/system.staff.tsx`
- `src/routes/auth.tsx`
- `src/routes/auth_.mfa-enroll.tsx`
- `src/routes/auth_.mfa-verify.tsx`
- `src/routes/index.tsx`
- `src/routes/lovable/email/auth/webhook.ts`
- `src/routes/lovable/email/transactional/send.ts`
- `src/routes/report.$token.tsx`
- `src/routes/security.tsx`
- `src/routes/set-password.tsx`
- `src/routes/signup.$token.tsx`
- `src/routes/unsubscribe.tsx`
- `src/styles.css`
- `tests/brand-contrast.test.ts`
- `tests/brand-email.test.tsx`

Design memory: `mem://design/color-tokens` and `mem://index.md`.
