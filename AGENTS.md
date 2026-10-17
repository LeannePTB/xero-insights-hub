- Overview uses stored snapshots, `evaluateClient` status and caller-scoped `overview_clients()`; never duplicate access rules in TypeScript.
- Sidebar spacer never shrinks; inset: flex-1 min-w-0, not w-full (clipping).
- AppShell owns the sole menu header; AppHeader registers actions there and renders standalone only outside, avoiding duplicate branding/lost actions.
- AppShell navigation uses `src/lib/nav/sidebar-nav.ts`, URL-selected (/system, /firms/:id, /clients/:id) and gated only by getMyContext signals; it stays presentation-only and database-movable.
- Branding/website use narrow anon display readers and separate audited AAL2 canonical-admin saves on the grant-free branding table. Public sales visuals are synthetic; media uses bounded admin-only storage INSERT, never bypassing blocked public buckets.

- System Admin pages reuse FirmPageHeader (one title, right-aligned actions); organisation detail uses URL-backed tabs on its guarded route, so deep links add no authorisation boundary.

### Client workspace and branding
- Client settings are child routes under `/clients/:clientId/settings/*`; keep the parent capability check and each existing server write guard.
- `me_can_manage_client` is a presentation signal only. Never infer access from a visible menu, relationship label, client ID or tenant ID.
- Monthly report primary-logo precedence is organisation report logo, then public platform logo, then bundled logo; an entitled client logo is secondary. Never regenerate final/sent PDFs.
- Product branding for server email/PDF work comes from the anon-safe `get_platform_branding()` reader. Sender domains and security/legal contact details remain fixed infrastructure text.
- Effective White label identity is database-resolved per organisation/client; it is independent of Advisory/Branding, never applies to System Admin/auth, and private logo paths never reach the browser.
- Authenticated pages use the shared left-aligned PageContainer; wide tables and matrices select its full-width mode rather than adding centred route wrappers.
- Typography uses shared Tailwind size tokens and PageHeader; only marked dashboard KPIs use the KPI utility, keeping density centralised.
- Print and email rendering use server-safe presentation tokens mirroring the global semantic palette, because CSS variables are unavailable in PDFs and email clients.
- Official web colours are represented by OKLCH semantic tokens; approved logo crops are bundled circular TA marks, because artwork must retain its proportions and the colour sheet's printed conversions are not authoritative.
- Bank-reconciliation warnings use only per-account dates, the cash account overlay and the recent-line window in `src/lib/overview/bank-reconciliation.ts`, never file-wide oldest dates. Missing data shows nothing.
- Protected money % is display-only (`protected-money-share.ts`); tax/debtor alerts come only from `health-checks.ts` rules shared by Overview and Business Health, so they never disagree.
- Viewer is one read-only login type whose scope (All clients via firm_viewer_access, Selected via client_access external_adviser rows) is changed only through `set_viewer_scope`, because the two storage paths must switch atomically without a new predicate.
- Login labels use `LOGIN_TYPE_LABEL`; DB keys stay unchanged, preserving access.
- Auth/public logos share display-only rendering. Auth routing defers events outside the session lock and retains idle/MFA guards.

- Charts share pure vector geometry between accessible SVG and jsPDF; history is caller-scoped and frozen only into new report drafts, so charts never widen access or refresh final/sent documents.
- Standard charts use card gates and resolved files; never infer unknown bases/scores. Enquiries use database eligibility and atomic scope/rate/audit checks; promotion grants no client access.
- Catalogue modules stay ordered; only Tax & compliance ignores saved order/disables dragging to preserve its pair. Layout grants no access; writes use `assert_card_manager`.
- Loans/Consolidations access is only `me_can_open_client_loans`/`me_can_open_consolidations`, called by readers, card and menu, so the rule exists once.
- Report sections come from `card_catalogue.report_sections` via `client_report_sections`, frozen into new drafts' `includedSections`: one list, final/sent untouched.
- Read nested `AGENTS.md` before edits.
- WIP early access (`org_early_access`) resolves only inside `client_cards_v2` for active org members, keeping one visibility path.
- Period video uses separate storage, caller-scoped audited RPCs and a draft-only attachment trigger; the unchanged notes builder preserves generation snapshots.
- Health uses the DB visibility/release rule; tax bill labels share `lodgedAtoBills` through a stored-only, card-gated reader (no access grant).
