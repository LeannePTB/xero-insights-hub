# White label add-on plan

## Recommendation and decisions

**Keep White label alongside Branding.** They serve different customers and different assets:

- **Branding** remains the Advisory-dependent per-client report-logo option. It lets each client place its own secondary logo on reports.
- **White label** is an independent organisation-level option. It replaces platform identity with the organisation's name and logo in that organisation's app, emails and report chrome.

Absorbing Branding would silently change an existing paid entitlement and make per-client report logos depend on a broader product. Keeping both preserves current purchases and access behaviour. White label will **not require Advisory** unless Leanne chooses that commercial dependency before build.

Use the existing organisation report logo as the white-label logo. Do **not** add a square icon yet: the current collapsed sidebar can show the same logo within a contained square; add a separate asset later only if real logos prove unreadable.

For auth emails, use the safest deterministic rule: keep them platform-branded. Password resets, magic links, email changes, signup confirmation, reauthentication and MFA are identity-level events; inferring one organisation at send time can disclose membership and can brand an account incorrectly after membership changes. Organisation invitations themselves are organisation-bound and will be white-labelled when entitled.

## Effective-branding rule

Add one caller-scoped database result that resolves the organisation from the current workspace/client and returns only:

- effective White label state: purchased, or explicitly included in an unexpired trial, and organisation subscription not lapsed;
- organisation display name;
- the existing private `firms.logo_path` only through the authorised server logo-signing path.

The database remains the single entitlement implementation. A URL `firmId`, `clientId` or tenant ID is only a filter. The function must assert AAL2, derive/confirm access with existing read predicates, and admit no new reader. System Admin deliberately ignores organisation branding and always uses platform branding.

If White label is removed, expires or the subscription lapses, every new app read, email and draft PDF immediately uses platform branding. The stored logo path and object remain untouched. Existing final/sent PDFs remain immutable.

## User experience

### System Admin

- **Organisations list:** add a compact, sortable **White label** column alongside Advisory, Consolidation and Branding, using tick/dash and muted `trial` treatment.
- **Organisation → Plan & options:** add purchased and trial White label switches to `OrgPurchaseCard`; include it in “Available now”, dirty state, audit metadata and cache invalidation.
- Existing super-admin-only, AAL2 database writes remain the only way to change the purchase/trial.

### Organisation subscription

- **Settings → Subscription:** show White label in the existing read-only purchase/trial summary, including trial end through the shared trial date.
- **Settings → General:** relabel the existing organisation report logo as **Organisation logo** and explain that it appears on reports and, while White label is effective, in the app and organisation emails. Keep PNG/JPEG, 2 MB, private storage and signed URLs. Add practical guidance: transparent PNG preferred, wide logo, minimum 320 px wide, avoid small text.

### App branding

Create an effective workspace-branding reader/hook consumed by the shell rather than teaching each surface its own entitlement logic.

```text
System Admin               Organisation/client workspace
Platform name + logo       White label effective? organisation name + signed logo
                           Otherwise platform name + platform logo
```

Apply it to:

- sidebar brand header, including the collapsed state;
- shared `AppHeader`;
- compact client-viewer header, adding the effective logo/name without exposing organisation navigation;
- page title suffix while on `/firms/:firmId/*` or `/clients/:clientId/*`.

Cross-organisation `/overview`, account settings, sign-in and all `/system/*` routes stay platform-branded. The favicon stays platform-wide because custom organisation domains are out of scope.

### Emails

Extend the internal email enqueue contract with an optional **authorised organisation branding context** resolved server-side from `firmId`; callers cannot provide a name, logo URL or entitlement boolean.

- Organisation member invites and client-viewer invites pass their already-authorised organisation ID.
- Report-ready email derives the organisation from the authorised report record.
- When effective: sender display name, subject/body `siteName`, and email header use the organisation name/logo.
- Otherwise: current platform branding fallback.
- Keep `noreply@tractionadvisory.app` and the verified sending domain unchanged.

Email logo feasibility: private short-lived signed URLs are unsuitable because emails may be opened after expiry and external image fetches may be delayed. Embed the authorised organisation logo as a small inline data image/CID if the current queue/provider supports it; otherwise ship name-only email white labelling in this batch and record private email logos as unfinished. Do not make the bucket or logo public.

### PDF reports

At draft generation/finalisation, derive effective White label from the report's stored `firm_id`:

- existing primary-logo precedence remains organisation logo → platform logo → bundled logo;
- product-name text in report header/footer becomes organisation name only when White label is effective, otherwise platform name;
- entitled client logo remains a secondary mark under the existing Branding option;
- final/sent PDFs are never regenerated, so a later entitlement change affects new reports only.

## Database changes

One migration, with no new table:

1. Add `white_label_enabled boolean not null default false` and `trial_white_label_enabled boolean not null default false` to `public.org_subscription_options`.
2. Extend `app_private.org_effective_options` with purchased/trial/effective White label. Preserve the 120-day shared trial maximum and “purchase or unexpired explicit trial” semantics.
3. Add `app_private.firm_white_label_enabled(firm_id)` as the canonical effective check, including the existing subscription-lapsed predicate.
4. Add authenticated, AAL2, caller-scoped read functions for organisation/client workspace branding. Reuse existing membership/viewer/support read predicates exactly; super-admin alone is not an organisation-data grant. Return no storage path/token to the browser, only a short-lived signed URL from an authorised server function.
5. Extend `org_purchase`, `set_org_purchase`, `set_org_trial`, organisation creation defaults, and System Admin organisation-overview/list results with White label fields. Keep super-admin assertions, validation, audit row and grants unchanged in strength.
6. Update function execute grants explicitly: revoke `PUBLIC`/`anon`; grant only the roles already allowed for the corresponding existing functions. No table grant widening and no new public table.
7. Update generated database types, RPC signatures, definer purposes/register, card/purchase fixtures and access-matrix proofs.

No catalogue card group changes are needed: White label changes identity presentation, not dashboard card availability. The organisation purchase catalogue/documentation will gain the fifth separately chargeable option.

## Security evidence to add

Add matrix/tests proving:

- active organisation member sees only their organisation's effective branding;
- a client viewer sees branding only for the exact client organisation they can read;
- unrelated member, unrelated viewer, support-only caller where the existing logo read rule denies, and super-admin-without-membership cannot obtain organisation branding;
- purchased and unexpired explicit trial enable it; expired trial and lapsed subscription disable it;
- direct browser booleans/names/logo paths cannot enable or substitute branding;
- removing White label hides but does not delete the logo;
- organisation-bound email/PDF resolution is server-derived;
- existing Branding client-logo allow/deny proofs remain unchanged.

Threats addressed: cross-organisation logo/name disclosure, browser-forged entitlement, super-admin data access, stale branding after lapse, private logo leakage and changing immutable reports.

## Files expected to change

### Database and security records
- new `supabase/migrations/<timestamp>_white_label_option.sql`
- generated `src/integrations/supabase/types.ts`
- `docs/security/access-matrix.ts`, generated matrix/definer/RPC fixtures and `docs/security-backlog.md`
- `docs/design/subscriptions-and-cards.md`, `AGENTS.md`, `roadmap.md`

### Purchase and organisation screens
- `src/lib/card-model.functions.ts`
- `src/lib/organisation-option-display.ts` and tests
- `src/components/admin/OrgPurchaseCard.tsx`
- `src/routes/_authenticated/system.index.tsx`
- `src/routes/_authenticated/firms.$firmId.settings.general.tsx`
- existing organisation-creation/purchase mapping files located during implementation

### App branding
- new focused effective-workspace-branding server function/hook
- `src/components/shell/AppSidebar.tsx`
- `src/components/AppHeader.tsx`
- `src/components/clients/ViewerClientNav.tsx`
- `src/components/branding/DocumentBranding.tsx`
- authenticated shell/layout route that provides workspace context
- `src/components/branding/LogoUploadCard.tsx`

### Email and reports
- `src/lib/email/send.server.ts`
- `src/lib/email-templates/firm-invite.tsx`, `report-ready.tsx`, and shared email header if present
- `src/lib/invites.functions.ts`
- `src/lib/viewers.functions.ts`
- `src/lib/reports/report-delivery.server.ts`
- `src/lib/reports/report-pdf.server.ts`
- transactional send/preview paths only where needed to preserve the same server-derived contract

## Routes and redirects

No new route and no redirect. Existing System Admin Plan & options, organisation Subscription/General, organisation workspaces and client workspaces gain the new presentation.

## Verification

- Add focused purchase/trial/effective-branding and cross-organisation isolation tests.
- Run organisation option tests, navigation and landing tests, email/template tests and report/PDF tests.
- Run `bunx tsgo`, production build and `bun run security:check`.
- Run `public.security_posture()` and the database linter; report any permission-limited checks without bypassing them.
- Browser-check System Admin, an entitled organisation member, that organisation's client viewer, an unrelated viewer, collapsed sidebar, lapse fallback and mobile layouts using an AAL2 session when available.

## Decision needed before build

Confirm the commercial dependency: **recommended — White label is independent of Advisory and Branding.** It can be purchased or trialled by any non-lapsed organisation, while Branding continues to gate only per-client secondary report logos.
