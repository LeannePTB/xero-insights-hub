# Client workspace, platform branding and overview routing

## Classification

**Security-relevant review, presentation/routing implementation.** The screens show client and Xero data, and the branding work touches PDFs, app emails and public email routes. No access rule, role, RLS policy, grant or entitlement change is proposed. Existing route and write guards remain authoritative; `me_can_manage_client` is only a screen signal.

Threats to avoid: revealing staff-only controls to read-only viewers; turning a client/tenant/organisation ID into a grant; exposing private logos; changing finalised reports; or weakening email/webhook verification.

## Part 1 — Client workspace audit and proposed navigation

### Current findings

- Staff/organisation members get the sidebar; pure client viewers get the bare header and **no client menu**.
- Current staff sidebar: Live Dashboard, Monthly reports, Cash flow scenario, Loans, Client settings, then Payables/Receivables by Xero file. Loan accounts and Xero audit have no menu entry.
- The dashboard duplicates “Back to organisation” and “All clients”; settings, loans, loan accounts, cash flow, audit, payables and receivables each have a bespoke back button. Dashboard, reports and cash flow also draw a second full app header inside AppShell.
- Settings is one 1,300-line page with Client name, Setup, Cards, Report branding, report basis, lodgement cycles, statutory accounts, Xero connections, People access, cost classification, cash commitments and Danger zone.
- `me_can_manage_client` currently gates dashboard/report staff controls and redirects viewers away from Settings. It is **not** used to hide controls on Loans, Loan accounts, Cash flow scenario or Audit.
- A pure viewer currently reaches Dashboard and Reports directly, plus entitled card drill-downs for Cash flow, Loans, Payables, Receivables and Audit. They cannot use Settings. The existing pages show mutation controls on Loans, Loan accounts, Cash flow and Audit even when `me_can_manage_client` is false; the database/server checks remain the real guard, but the presentation is inconsistent.

### Final staff client menu

```text
Client
  Live Dashboard
  Monthly reports
  Cash flow scenario
  Loans
    Loan matrix
    Loan accounts
  Xero files
    Payables       > file(s)
    Receivables    > file(s)
    Xero audit     > file(s)
  Client settings
    General
    Cards & report branding
    People
    Xero connections
    Tax & reporting
    Cost & cash commitments
    Danger zone
```

- Keep the existing `/clients/:clientId` routes and add settings child routes. Convert the current settings leaf into an `<Outlet />` layout and move its current sections without changing their calls or guards.
- Put report basis, statutory accounts and lodgement cycles together under **Tax & reporting**. There is no existing Rental properties settings editor, so this batch will not invent one.
- Add Xero Audit beside Payables/Receivables, using per-file sub-items. Only show drill-downs backed by the client’s existing enabled-card result; hiding a link grants or revokes nothing.
- Remove redundant back buttons, duplicate `ViewToggle`, “Client Settings” shortcut and duplicate full headers. Use `FirmPageHeader` (renamed to a neutral shared `PageHeader`) consistently, with page actions on the right.

### Client-viewer presentation

- Keep the current bare layout. Add a compact client header with only **Live Dashboard** and **Monthly reports**; entitlement-backed drill-down links remain on the cards exactly as today.
- Use `me_can_manage_client` to hide staff-only menu items and mutation controls. Read-only viewer pages retain their present readable content; staff controls on Loans, Loan accounts, Cash flow and Audit disappear when the signal is false.
- This does not expand business-owner or external-adviser access. It deliberately does not infer write capability from relationship, role or URL.

### Routes and redirects

- Keep: `/clients/:clientId`, `/reports`, `/cashflow-scenario`, `/loans`, `/loans-accounts`, `/payables/:tenantId`, `/receivables/:tenantId`, `/audit/:tenantId`.
- Create settings leaves: `/settings/general`, `/settings/cards`, `/settings/people`, `/settings/xero`, `/settings/tax-reporting`, `/settings/costs`, `/settings/danger`.
- Redirect `/clients/:clientId/settings` to `/clients/:clientId/settings/general` after the same existing capability check. Preserve any supported Xero callback query parameters when redirecting.

## Part 2 — Platform branding everywhere

### Implementation

- Add one shared public branding reader around the existing anon-safe `get_platform_branding()` function. Use it for initial document branding and server-side email/PDF work; keep bundled assets and “Traction Advisory” as the fallback.
- Make favicon and browser page-title suffix follow `favicon` and `productName`. Keep every route’s unique title/description/social metadata; centralise the branded title suffix so routes stop hardcoding the product name.
- Update sign-in, invite acceptance, password setup, MFA, account pages, public report/unsubscribe pages and authenticated page titles/copyright/product references to use platform branding.
- PDF rendering remains deterministic: resolve branding before the pure renderer runs, embed bytes once, and never alter an already-finalised/sent PDF. Header precedence will be **organisation report logo first, platform logo second, bundled logo last**. The platform product name replaces hardcoded footer/header text. Existing client report logos remain a secondary mark alongside the winning organisation/platform mark rather than overriding it.
- App email sender display name comes from `emailSenderName`; template subject/body product references come from `productName`. Apply this to firm-invite, report-ready, invite, magic-link, recovery, signup, email-change and reauthentication. Keep the verified sender/root domains unchanged.
- Keep authentication webhook verification, queueing, suppression, unsubscribe and recipient handling unchanged.

### Remaining hardcoded-brand inventory

**Make branding-driven:**
- Root and public pages: `src/routes/__root.tsx`, `auth.tsx`, `auth_.mfa-enroll.tsx`, `auth_.mfa-verify.tsx`, `signup.$token.tsx`, `set-password.tsx`, `report.$token.tsx`, `unsubscribe.tsx`.
- Authenticated titles/copy: `dashboard.tsx`, `overview.tsx`, all current client route files, organisation Overview/Clients/Consolidation/Loans route files, System Admin index/staff/security/organisation-detail pages, account/activity pages, `SupportAccessCard.tsx`, `LogoUploadCard.tsx`, `PeopleSection.tsx`.
- Reports/exports: `report-pdf.server.ts`, `report-verdict.server.ts`, `MonthlyReportPreview.tsx`, `ReportVerdictPage.tsx`, and the visible XLSX creator metadata in `loan-consolidation-export.server.ts`.
- Emails: `email/send.server.ts`, auth webhook/preview routes, `firm-invite.tsx`, `report-ready.tsx`, `invite.tsx`, `magic-link.tsx`, `recovery.tsx`, `signup.tsx`, `email-change.tsx`, `reauthentication.tsx`.
- Operational user-facing wording: the Xero callback’s “contact …” message and MFA issuer label.

**Keep fixed:**
- `DEFAULT_BRANDING` product name and bundled Traction Advisory logo imports: these are the required fallback.
- Verified email domains, custom/public domain URLs and `security@tractionadvisory.com.au`: infrastructure/contact facts, not visual branding.
- “Xero” and other vendor names.
- Internal comments and historical plan text. References that specifically identify the operating practice/team may stay legal/operational text; user-facing generic product references become branding-driven.

## Part 3 — Overview gaps

- Reuse caller-scoped `listMyFirms()` data already returned to the menu. Extend `landingFor` with the single organisation’s existing `clientCount`: zero goes to `/firms/:firmId` (Clients), otherwise to `/firms/:firmId/overview`.
- Add **All organisations** at the top of the workspace switcher only for people with 2+ organisation memberships; it opens `/overview`. Keep each organisation entry opening its Clients page.
- Remove the accidental duplicate `/overview` item/id from the per-organisation sidebar; cross-organisation Overview belongs in the switcher, not every organisation menu.
- `firmId` remains a filter in the caller-scoped overview read, never a grant.

## Files

### New
- `src/components/clients/ClientPageHeader.tsx`
- `src/components/clients/ClientSettingsNav.tsx`
- `src/lib/platform-branding.server.ts`
- Settings leaf route files under `src/routes/_authenticated/clients.$clientId.settings.*.tsx`

### Main existing files
- Client navigation/shell: `src/lib/nav/sidebar-nav.ts`, `src/components/shell/AppSidebar.tsx`, `src/components/shell/WorkspaceSwitcher.tsx`, `src/components/firm/FirmPageHeader.tsx`, all eight `/clients/:clientId/*` route files, `src/routes/_authenticated/route.tsx`.
- Branding/head: `src/hooks/usePlatformBranding.ts`, `src/routes/__root.tsx`, the user-facing route/component files listed in the inventory above.
- PDFs: `src/lib/reports/report-pdf.server.ts`, `src/lib/reports/monthly-report.server.ts`, report preview/verdict components and existing branding helpers.
- Emails: both send entry points, auth preview and all eight listed templates.
- Landing: `src/lib/nav/landing.ts`, `src/routes/_authenticated/dashboard.tsx`.
- Tests/docs: `src/lib/nav/landing.test.ts`, `src/lib/nav/sidebar-nav.test.ts`, focused client-menu/title helper tests, `AGENTS.md`, `roadmap.md`, `docs/security-backlog.md`.

## Database changes

**None.** Existing platform-branding fields/RPCs, organisation/client logo paths, caller-scoped organisation counts, entitlements and access predicates are sufficient.

## Guard preservation and checks

- No changes to RLS, grants, roles, relationships, support access, `user_can_write_client`, `me_can_manage_client`, Xero access or entitlement calculation.
- Before implementation, re-check every Loans/Cash flow/Audit mutation’s server/database predicate. If any write relies only on read access, stop and report the conflict rather than changing access in this batch.
- Run focused navigation/landing tests, `tsgo`, build, `bun run security:check`, database security posture and linter. Verify staff and viewer presentations separately; if MFA still blocks browser review, report that limitation without claiming visual verification.
