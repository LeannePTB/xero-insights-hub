## Goal
Rebuild `/admin/security` to mirror the Business Hub Central layout: single integrated page with header actions, Posture card, inline Section 1 contact form, and a sidebar+content markdown viewer with bundled `?raw` imports and a client-side jsPDF "Download Xero PDF" — replacing the current split components and broken `/api/public/docs/security/$file` fetch.

## Changes

### 1. Rewrite `src/routes/_authenticated/admin/security.tsx` (or current `admin.security.tsx`)
Port hub's `admin.security.tsx` 1:1, adjusted for this project:
- Import all 9 policy markdown files from `docs/security/*.md?raw` directly into the route module (no runtime fetch, no `PoliciesViewer` component, no API route).
- Header: title "Security policies" + buttons `Download Xero PDF`, `Download all (.md)`, `Audit log` (linking to existing activity feed route in this project).
- `<SecurityPostureCard />` (new wrapper around existing `getSecurityPosture`).
- Section 1 inline card: 2-col grid of 12 contact fields + 1.5 textarea, Edit/Save/Cancel via TanStack Query mutation.
- Sidebar nav (220px) + Card content rendering active doc with `ReactMarkdown` + `remark-gfm` inside `prose prose-sm` so tables/headings render correctly (current screenshot shows broken table rendering).
- Section 1 values injected into the Xero assessment mapping doc body before `## Section 2`.
- `downloadAll` builds a single `.md` blob (hub style) instead of the current JSZip bundle.
- `downloadXeroPdf` calls new `buildXeroAssessmentPdf` to generate the PDF client-side, replacing the print route.

### 2. Add `src/lib/xero-assessment.functions.ts`
Port hub file verbatim. Server fns `getAssessmentContact` / `saveAssessmentContact` reading/writing a new singleton table `xero_assessment_contact` (id text PK = 'singleton'). Admin gated via `has_role(_, 'super_admin')` (project's equivalent of hub's 'admin').

### 3. Add `src/lib/xero-assessment-pdf.ts`
Port hub file verbatim (jsPDF + jspdf-autotable cover page, Section 1 table, Section 2..N parsed from `xero-assessment-mapping.md`, embedded policy docs per section). Install `jspdf` and `jspdf-autotable`.

### 4. Add `src/components/admin/SecurityPostureCard.tsx`
Thin wrapper consuming the existing `getSecurityPosture` from `src/lib/security.functions.ts`, rendering OK/Warn/Action pills like hub. Adapt to current posture shape (the existing fn already returns the needed fields; add a minimal adapter if the shape differs).

### 5. Migration: create `xero_assessment_contact`
```
create table public.xero_assessment_contact (
  id text primary key default 'singleton',
  legal_name text, trading_name text, abn_acn text, address text,
  website text, app_name text, xero_client_id text,
  contact_name text, contact_role text, contact_email text, contact_phone text,
  assessment_date text, api_usage_description text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.xero_assessment_contact to authenticated;
grant all on public.xero_assessment_contact to service_role;
alter table public.xero_assessment_contact enable row level security;
create policy "super_admin read"  on public.xero_assessment_contact for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "super_admin write" on public.xero_assessment_contact for all    to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
```
Seed with the previously confirmed Positive Traction details (migrated from the existing `security_contact_details` row).

### 6. Remove now-unused code
- Delete `src/components/security/PoliciesViewer.tsx` and `ContactDetailsCard.tsx`.
- Delete `src/routes/api/public/docs/security/$file.ts`.
- Delete the `xero-assessment-print` route.
- Drop the old `security_contact_details` table after the data is migrated.

## Result
The page renders identically to Business Hub Central (correct markdown tables, inline Section 1 editor, real client-side Xero PDF), uses bundled `?raw` markdown so nothing depends on runtime file fetches.