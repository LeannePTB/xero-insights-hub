- Client overview reads stored snapshots only and derives status from `evaluateClient`; its client list comes from the caller-scoped `overview_clients()` — never re-implement who-can-see-what in TypeScript.
- Bank/card extraction is shared in `tax-lines.ts`; the ID-keyed bank-classification overlay applies explicit client/file/account overrides before Xero BankAccountType, never name guesses, so stored and live figures agree without rewriting Xero metadata.
- Sidebar layouts reserve width through the non-shrinking sidebar spacer; the main inset uses flex-1 and min-w-0 without w-full, so collapsed navigation cannot crowd or clip page content.
- Client income tax instalments use one dedicated period-history table and one audited caller-scoped save function, because period history and organisation-team-only editing must stay explicit.
- Navigation is one AppShell whose menu is data in `src/lib/nav/sidebar-nav.ts`, chosen by the URL (/system, /firms/:id, /clients/:id) and gated only by getMyContext server signals, because the menu must stay presentation-only and be movable to the database later.
- Platform branding is read through the anon-callable `get_platform_branding()` with bundled-asset fallback and written only via `save_platform_branding()`, because sign-in pages need it before login while the table stays grant-free.

- System Admin pages reuse FirmPageHeader for a single title and right-aligned actions, keeping workspace headers consistent without duplicating header markup.
- System Admin organisation detail uses URL-backed tabs on its existing guarded route, so deep links do not duplicate authorisation boundaries.

### Client workspace and platform branding (9 Oct 2026)
- Client settings are child routes under `/clients/:clientId/settings/*`; keep the parent capability check and each existing server write guard.
- `me_can_manage_client` is a presentation signal only. Never infer access from a visible menu, relationship label, client ID or tenant ID.
- Monthly report primary-logo precedence is organisation report logo, then public platform logo, then bundled logo; an entitled client logo is secondary. Never regenerate final/sent PDFs.
- Product branding for server email/PDF work comes from the anon-safe `get_platform_branding()` reader. Sender domains and security/legal contact details remain fixed infrastructure text.
- Effective White label identity is database-resolved per organisation/client; it is independent of Advisory/Branding, never applies to System Admin/auth, and private logo paths never reach the browser.
- Authenticated pages use the shared left-aligned PageContainer; wide tables and matrices select its full-width mode rather than adding centred route wrappers.
- App typography is governed by the shared Tailwind size tokens and PageHeader; only explicitly marked dashboard KPI figures use the separate KPI utility, so density changes remain centralised.
- Print and email rendering use server-safe presentation tokens mirroring the global semantic palette, because CSS variables are unavailable in PDFs and email clients.
- Trixie conversations are session-only: store allowance and token metadata for 13 months, never prompts or answers, so financial conversations cannot become a second client-data repository.
- Trixie alerting runs as one scheduled public route calling service-role-only database functions, because alert evaluation needs every organisation's usage and no signed-in caller exists.
- Trixie spend is priced in TypeScript from recorded token counts (`src/lib/trixie/trixie-cost.ts`), so the per-question cost guard and the spend reports use one rate table.
