# Single-header fix — full route audit

## Result
AppShell owns the only application top bar within the side-menu layout. AppHeader supplies page actions through context without drawing another bar. Standalone AppHeader retains its existing appearance, Sign out and HeaderPresence registration. Reports no longer draws its own AppHeader: both its menu layout and its bare client navigation already supply one bar.

Counts below refer to application top bars, not page titles, sidebar branding, View-as banners, report content logos or the branding inside sign-in forms. Public/auth pages without a top bar keep their existing form/content branding; no new chrome was added. “Conditional” means the existing authenticated layout chooses AppShell from server signals; no permissions or layout selection rules changed. Bare counts describe rendered composition only, not permission to visit a route. Redirect/endpoint rows do not have a persistent page header. Layout rows describe inherited composition where applicable.

Light/dark logo branches remain unchanged: one logo is displayed at a time; when light/dark artwork differs there are two mutually exclusive image elements, not two displayed logos. Sidebar monogram/workspace switcher are excluded and unchanged.

## Every route source file

| Source file | Public path / layout | Kind | Shell | Shell/header before → after | Bare layout before → after |
|---|---|---|---|---|---|
| `src/routes/__root.tsx` | `(root document)` | Layout | No | See child pages → See child pages | See child pages |
| `src/routes/_authenticated/admin.firms.$firmId.tsx` | `/admin/firms/$firmId` | Redirect | Conditional | N/A (redirect) → N/A (redirect) | N/A (redirect) |
| `src/routes/_authenticated/admin.index.tsx` | `/admin/` | Redirect | Conditional | N/A (redirect) → N/A (redirect) | N/A (redirect) |
| `src/routes/_authenticated/admin.security.tsx` | `/admin/security` | Redirect | Conditional | N/A (redirect) → N/A (redirect) | N/A (redirect) |
| `src/routes/_authenticated/admin.tsx` | `/admin` | Layout | Conditional | See child pages → See child pages | See child pages |
| `src/routes/_authenticated/clients.$clientId.audit.$tenantId.tsx` | `/clients/$clientId/audit/$tenantId` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.cashflow-scenario.tsx` | `/clients/$clientId/cashflow-scenario` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.index.tsx` | `/clients/$clientId/` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.loans-accounts.tsx` | `/clients/$clientId/loans-accounts` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.loans.tsx` | `/clients/$clientId/loans` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.payables.$tenantId.tsx` | `/clients/$clientId/payables/$tenantId` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.receivables.$tenantId.tsx` | `/clients/$clientId/receivables/$tenantId` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.reports.tsx` | `/clients/$clientId/reports` | Page | Conditional | 2 → 1 | 2 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.cards.tsx` | `/clients/$clientId/settings/cards` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.costs.tsx` | `/clients/$clientId/settings/costs` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.danger.tsx` | `/clients/$clientId/settings/danger` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.general.tsx` | `/clients/$clientId/settings/general` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.people.tsx` | `/clients/$clientId/settings/people` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.tax-reporting.tsx` | `/clients/$clientId/settings/tax-reporting` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.tsx` | `/clients/$clientId/settings` | Layout | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.$clientId.settings.xero.tsx` | `/clients/$clientId/settings/xero` | Page | Conditional | 1 → 1 | 1 → 1 |
| `src/routes/_authenticated/clients.new.tsx` | `/clients/new` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/dashboard.tsx` | `/dashboard` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.consolidated.$groupId.tsx` | `/firms/$firmId/consolidated/$groupId` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.consolidations.tsx` | `/firms/$firmId/consolidations` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.index.tsx` | `/firms/$firmId/` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.loans.accounts.tsx` | `/firms/$firmId/loans/accounts` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.loans.groups.tsx` | `/firms/$firmId/loans/groups` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.loans.index.tsx` | `/firms/$firmId/loans/` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.loans.tsx` | `/firms/$firmId/loans` | Layout | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.overview.tsx` | `/firms/$firmId/overview` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.people.tsx` | `/firms/$firmId/people` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.settings.cards.tsx` | `/firms/$firmId/settings/cards` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.settings.general.tsx` | `/firms/$firmId/settings/general` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.settings.index.tsx` | `/firms/$firmId/settings/` | Redirect | Conditional | N/A (redirect) → N/A (redirect) | N/A (redirect) |
| `src/routes/_authenticated/firms.$firmId.settings.ownership.tsx` | `/firms/$firmId/settings/ownership` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.settings.subscription.tsx` | `/firms/$firmId/settings/subscription` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.settings.support.tsx` | `/firms/$firmId/settings/support` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.settings.tsx` | `/firms/$firmId/settings` | Layout | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.tsx` | `/firms/$firmId` | Layout | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/firms.$firmId.xero-files.tsx` | `/firms/$firmId/xero-files` | Page | Conditional | 2 → 1 | 1 → 1 |
| `src/routes/_authenticated/overview.tsx` | `/overview` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/route.tsx` | `(authenticated layout)` | Layout | Conditional | See child pages → See child pages | See child pages |
| `src/routes/_authenticated/settings.account.tsx` | `/settings/account` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/settings.activity.tsx` | `/settings/activity` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/settings.advisors.tsx` | `/settings/advisors` | Redirect | Conditional | N/A (redirect) → N/A (redirect) | N/A (redirect) |
| `src/routes/_authenticated/settings.practice-team.tsx` | `/settings/practice-team` | Redirect | Conditional | N/A (redirect) → N/A (redirect) | N/A (redirect) |
| `src/routes/_authenticated/system.branding.tsx` | `/system/branding` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/system.index.tsx` | `/system/` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/system.organisations.$firmId.tsx` | `/system/organisations/$firmId` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/system.security.tsx` | `/system/security` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/system.staff.tsx` | `/system/staff` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/system.trixie.tsx` | `/system/trixie` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/_authenticated/system.tsx` | `/system` | Layout | Conditional | See child pages → See child pages | See child pages |
| `src/routes/_authenticated/system.xero.tsx` | `/system/xero` | Page | Conditional | 1 → 1 | 0 → 0 |
| `src/routes/api/public/security/run-access-tests.ts` | `/api/public/security/run-access-tests` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/public/stripe/webhook.ts` | `/api/public/stripe/webhook` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/public/trixie/alerts.ts` | `/api/public/trixie/alerts` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/public/xero/callback.ts` | `/api/public/xero/callback` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/public/xero/connection-cleanup.ts` | `/api/public/xero/connection-cleanup` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/public/xero/signup.ts` | `/api/public/xero/signup` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/public/xero/snapshot-refresh.ts` | `/api/public/xero/snapshot-refresh` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/api/trixie.ts` | `/api/trixie` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/auth.tsx` | `/auth` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/auth_.mfa-enroll.tsx` | `/auth/mfa-enroll` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/auth_.mfa-verify.tsx` | `/auth/mfa-verify` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/email/unsubscribe.ts` | `/email/unsubscribe` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/index.tsx` | `/` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/lovable/email/auth/preview.ts` | `/lovable/email/auth/preview` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/lovable/email/auth/webhook.ts` | `/lovable/email/auth/webhook` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/lovable/email/queue/process.ts` | `/lovable/email/queue/process` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/lovable/email/suppression.ts` | `/lovable/email/suppression` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/lovable/email/transactional/preview.ts` | `/lovable/email/transactional/preview` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/lovable/email/transactional/send.ts` | `/lovable/email/transactional/send` | Endpoint | No | N/A → N/A | N/A |
| `src/routes/report.$token.tsx` | `/report/$token` | Public/auth page | No | 1 → 1 | 1 → 1 |
| `src/routes/security.tsx` | `/security` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/set-password.tsx` | `/set-password` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/signup.$token.tsx` | `/signup/$token` | Public/auth page | No | 0 → 0 | 0 → 0 |
| `src/routes/unsubscribe.tsx` | `/unsubscribe` | Public/auth page | No | 0 → 0 | 0 → 0 |

## Page-level component audit
- AppHeader: previously drew another bar in AppShell; now draws none there and registers/cleans up its actions. Outside AppShell its standalone bar is unchanged.
- AppShell: one card-background, bottom-border bar with the original toggle and unchanged light/dark logo sizing, plus page actions, notification bell and avatar initial.
- PageHeader, ClientPageHeader, FirmPageHeader: titles/descriptions/actions only; no application bar or logo. Unchanged.
- ViewAsBanner: informational banner beneath the application bar, not counted as another header. Unchanged.
- ViewerClientNav: bare client navigation bar, one logo; unchanged. Reports' redundant AppHeader removed to prevent two bars here too.
- Report token page: standalone report header; unchanged. Logos inside report previews/PDF content are document branding, not application chrome.
- Auth, password, invitation and security pages: content/form branding, not extra top bars; unchanged.
- Overview, client dashboard, client settings, system screens and organisation pages: page title rows stay in place; no other application top bars found.

## Files changed
Application code:
- src/components/AppHeader.tsx
- src/components/HeaderAccountActions.tsx (shared bell/avatar/sign-out cluster)
- src/components/shell/AppShell.tsx
- src/components/shell/shell-context.tsx
- src/routes/_authenticated/clients.$clientId.reports.tsx (only removed redundant AppHeader import/render)

Tests/dependencies/records:
- tests/app-header.test.tsx
- package.json and bun.lock (rendered-component test tools)
- AGENTS.md
- roadmap.md
- docs/security-backlog.md
- docs/design/header-route-audit.md (this report)
- Project memory: application-header preference

## Verification
- Automatic compilation: build OK after the header changes.
- Four rendered-component tests pass: one header/banner and one logo with page actions; action updates and unmount cleanup; independent parent/child action cleanup; standalone Sign out and floating fallback registration.
- Application tests: 198 passed, 0 failed across 26 files (including navigation tests).
- Security regression suite: 198 tests pass, 1,973 access proofs pass with zero known failures; live access checks 18 passed / 0 failed / 0 inconclusive; catalogue fingerprint and registered database rules unchanged.
- Real signed-in Overview: navigation reached /auth/mfa-verify. Interactive two-factor verification blocks live authenticated visual checking; no bypass was used. Tests above use mocked branding/account reads and are not claimed as real-user end-to-end verification.
- No menus, permissions, server functions, database objects, financial calculations, page titles or colour tokens were changed. Only the requested shell background now uses the existing card token.
