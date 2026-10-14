- Client overview reads stored snapshots only and derives status from `evaluateClient`; its client list comes from the caller-scoped `overview_clients()` — never re-implement who-can-see-what in TypeScript.
- Bank/card extraction is shared in `tax-lines.ts`; the ID-keyed bank-classification overlay applies explicit client/file/account overrides before Xero BankAccountType, never name guesses, so stored and live figures agree without rewriting Xero metadata.
- Sidebar spacer stays non-shrinking; inset uses flex-1 min-w-0, never w-full, to avoid clipping.
- AppShell owns the sole menu-layout header; AppHeader supplies context-registered actions there and renders standalone only outside, preventing duplicate branding and lost actions.
- Client income tax instalments use one period-history table and audited caller-scoped save; history and organisation-team-only editing stay explicit.
- AppShell navigation uses `src/lib/nav/sidebar-nav.ts`, URL-selected (/system, /firms/:id, /clients/:id) and gated only by getMyContext signals; it stays presentation-only and database-movable.
- Branding/website use narrow anon display readers and separate audited AAL2 canonical-admin saves on the grant-free branding table. Public sales visuals are synthetic; media uses bounded admin-only storage INSERT, never bypassing blocked public buckets.

- System Admin pages reuse FirmPageHeader: one title, right-aligned actions, consistent headers without duplicate markup.
- System Admin organisation detail uses URL-backed tabs on its existing guarded route, so deep links do not duplicate authorisation boundaries.

### Client workspace and branding
- Client settings are child routes under `/clients/:clientId/settings/*`; keep the parent capability check and each existing server write guard.
- `me_can_manage_client` is a presentation signal only. Never infer access from a visible menu, relationship label, client ID or tenant ID.
- Monthly report primary-logo precedence is organisation report logo, then public platform logo, then bundled logo; an entitled client logo is secondary. Never regenerate final/sent PDFs.
- Product branding for server email/PDF work comes from the anon-safe `get_platform_branding()` reader. Sender domains and security/legal contact details remain fixed infrastructure text.
- Effective White label identity is database-resolved per organisation/client; it is independent of Advisory/Branding, never applies to System Admin/auth, and private logo paths never reach the browser.
- Authenticated pages use the shared left-aligned PageContainer; wide tables and matrices select its full-width mode rather than adding centred route wrappers.
- App typography is governed by the shared Tailwind size tokens and PageHeader; only explicitly marked dashboard KPI figures use the separate KPI utility, so density changes remain centralised.
- Print and email rendering use server-safe presentation tokens mirroring the global semantic palette, because CSS variables are unavailable in PDFs and email clients.
- Official web colours are represented by OKLCH semantic tokens; approved logo crops are bundled circular TA marks, because artwork must retain its proportions and the colour sheet's printed conversions are not authoritative.
- Trixie chats are saved per person in `trixie_threads`/`trixie_messages` (owner-only RLS that re-checks client/organisation read access on every read; visible text and source labels only, never tool payloads), written by the Trixie route as the caller, because history must never outlive or widen the person's current access.
- Trixie alerting runs as one scheduled public route calling service-role-only database functions, because alert evaluation needs every organisation's usage and no signed-in caller exists.
- Trixie spend is priced in TypeScript from recorded token counts (`src/lib/trixie/trixie-cost.ts`), so the per-question cost guard and the spend reports use one rate table.
- Bank-reconciliation warnings use only `client_key_figures.bank_reconciliation` per-account dates, cash's account-settings overlay and the recent-line window in `src/lib/overview/bank-reconciliation.ts`; file-wide oldest dates include closed accounts/ancient leftovers. Missing data shows nothing.
- Protected money is compared with cash at bank only through `src/lib/health/protected-money-share.ts`, because the health rule, Overview, reports and Trixie must agree on one definition.
- Viewer is one read-only login type whose scope (All clients via firm_viewer_access, Selected via client_access external_adviser rows) is changed only through `set_viewer_scope`, because the two storage paths must switch atomically without a new predicate.
- Login labels use `LOGIN_TYPE_LABEL`; database keys stay unchanged to preserve access rules.
- Auth/public logos share display-only rendering and official fallback; auth logic stays route-owned.

- Charts share pure vector geometry between accessible SVG and jsPDF; history is caller-scoped and frozen only into new report drafts, so charts never widen access or refresh final/sent documents.
- Card catalogue (packages, Advisory modules, descriptions) lives in `card_catalogue`/`card_modules`, read by `card_group_cards`; modules group `client_cards` and every card write passes `assert_card_manager`, so there is one list and one rule.
