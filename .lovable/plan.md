# Security & Compliance admin — port from hub

Extend `/admin/security` to match the hub layout in the screenshots. Keep the page title **Security & Compliance** and the existing Posture card. Add the contact-details form, the policies viewer with sidebar tabs, and the three download/log buttons.

## New page layout (top to bottom)

1. Header — `Security & Compliance` (unchanged).
2. **Posture** card — unchanged (already implemented).
3. **Section 1 — Contact details** card with `Edit` button. Two-column grid:
   - Company legal name, Trading name
   - ABN / ACN, Registered address
   - Website, App name (as registered with Xero)
   - Xero app ID / client ID, Primary contact name
   - Primary contact role, Primary contact email
   - Primary contact phone, Assessment date
   Read-only by default; `Edit` toggles inputs and shows Save / Cancel.
4. **Section 1.5 — How your application uses the Xero API** card with multi-line textarea (same edit toggle as Section 1, or saved together).
5. **Security policies** card header with three buttons on the right:
   - **Download Xero PDF** (primary)
   - **Download all (.md)** (outline)
   - **Audit log** (outline) → links to existing `/settings/activity`
   Body = two-pane layout:
   - Left sidebar: Overview, Access control, Data hosting, Data retention, Incident response, Security monitoring, SDLC, Vulnerability management, Xero assessment mapping.
   - Right pane: renders the selected markdown doc fetched from `/api/public/docs/security/<slug>.md` using `react-markdown` + `remark-gfm` (already common in shadcn projects; add if missing).
   First tab (Overview) shows the README content.

## Data model

New table `public.security_contact_details` — single row keyed by an admin scope. Since this is a super-admin global setting (one firm operating the app), use a singleton row pattern: `id uuid pk default gen_random_uuid()`, `singleton boolean unique default true check (singleton)`, plus the fields above (`company_legal_name`, `trading_name`, `abn`, `registered_address`, `website`, `app_name`, `xero_client_id`, `primary_contact_name`, `primary_contact_role`, `primary_contact_email`, `primary_contact_phone`, `xero_api_usage` text, `assessment_date date`, timestamps).
GRANTs: `service_role` ALL; no `authenticated` direct access — reads/writes go through super-admin server fns. RLS enabled, deny-all policy (server fns use admin client).

## Server functions (`src/lib/security.functions.ts`)

- `getSecurityContact()` — super-admin only, returns the singleton row or nulls.
- `saveSecurityContact(input)` — super-admin only, upserts singleton, audit-logs `security_contact_updated`.

## Downloads

- **Download all (.md)** — client-side zip of all 9 policy docs (fetch each from existing `/api/public/docs/security/*.md` route) using `jszip` (add dep). Filename `traction-advisory-security-policies.zip`.
- **Download Xero PDF** — new public-shaped print route `/admin/security/xero-assessment.print` rendering Sections 1, 1.5, posture summary, and the assessment-mapping doc with `@media print` styling; user clicks Print → Save as PDF. No serverless PDF lib needed (Workers can't run headless Chromium).
- **Audit log** — `<Link to="/settings/activity">`.

## Files

- Edit `src/routes/_authenticated/admin.security.tsx` — add Contact details card, Xero API usage card, Policies card with sidebar + markdown pane, three action buttons.
- New `src/components/security/ContactDetailsCard.tsx`, `XeroApiUsageCard.tsx`, `PoliciesViewer.tsx`.
- New `src/routes/_authenticated/admin.security.xero-assessment.print.tsx` — print-friendly composite page.
- Extend `src/lib/security.functions.ts` with the two new server fns.
- New migration creating `security_contact_details` with GRANTs and RLS.
- Add deps: `jszip`, `react-markdown`, `remark-gfm`.

## Out of scope

- Editing the markdown policy docs in-app (still file-backed under `docs/security/`).
- Multi-firm scoping (singleton row is sufficient — one operating firm).
