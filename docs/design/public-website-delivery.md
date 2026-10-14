# Public website delivery — 14 October 2026

## Copy
Headline: **Better client conversations. Backed by their numbers.**
Subhead: **Xero dashboards and monthly reports that help your practice see the whole picture — and help your clients understand what matters.**

Practices-first hero, trust strip, practice benefits, business-owner section, five illustrated feature-tour blocks, optional walkthrough, four package summaries, security/legal summary, six FAQs, final CTA and footer are implemented. Images are fictional illustrations, not screenshots of real clients. Prices and walkthrough stay hidden until supplied. Empty booking URL sends visitors to the existing request-access form. Signed-in root visitors enter the existing `/dashboard` resolver and MFA gate, without new access rules.

## Settings and access changes
- `platform_branding.website_settings`: public display settings only. No direct table privileges added; no organisation/client policies changed.
- `get_public_website_settings()`: explicitly granted anon/authenticated/service-role EXECUTE, PUBLIC revoked. Returns eight allowlisted display fields only.
- `save_public_website_settings(jsonb)`: PUBLIC/anon EXECUTE revoked; authenticated/service-role invocation still requires canonical System Administrator and AAL2. Validates keys, HTTPS booking/embed hosts, media paths and price lengths. Audit records actor and changed field names, not values.
- `storage.objects.website_media_admin_insert`: bounded MP4/poster INSERT for AAL2 System Administrators only, within `website-media`; no viewer/member/support writes.
- CSP permits only approved Loom/YouTube embed origins and Supabase media.
- Access matrix, RPC/definer register, structural fixture and public server-function allowlist updated. Tests prove anonymous projection, blocked direct writes, admin audit, AAL1/admin rejection and support-without-admin rejection.

## Verification
Automatic compilation/build log reports build OK. Full security suite: 224 tests passed, 18 live checks passed, no failures/inconclusive results; 198 application tests passed. Public Playwright: desktop/mobile fit, one header, loaded illustration images, SEO title/OG, four-public-page sitemap, robots, request-access fallback and /auth preserved; no runtime errors. Minted owner session routes through the existing MFA verification gate; post-MFA workspace and authenticated settings saves were not interactively verified. Manual tsgo/build commands were not run because platform compilation is automatic.

Live grants confirmed anon reader allowed, anon save denied, authenticated guarded-save callable, direct anon SELECT/authenticated UPDATE denied. Database linter's anon definer warning for the new intentionally public projection was reviewed; broad existing authenticated-definer warnings remain guarded. Direct security_posture invocation via read-query tooling is privilege-denied; the full security/live suites passed instead.

## Unfinished / owner inputs
1. DONE 14 Oct: `website-media` created via Storage API — public read, 25 MB cap. Live checks: anon read of a synthetic test poster = 200; anon upload, overwrite and delete = denied (RLS). `website_media_admin_insert` is the only policy on the bucket (AAL2 System Administrator INSERT, MIME/size/path bounded; poster ≤2 MB in policy and app); no update/delete for anyone. Open: bucket-level MIME allowlist cannot be set with available tools (policy enforces it); AAL2 admin upload through the Website editor still to be tried.
2. Supply Calendly booking URL, MP4 hero (≤25 MB), PNG/JPG/WebP poster (≤2 MB), Loom/YouTube walkthrough URL, real Demo Practice screenshots and optional package price labels.
3. Verify authenticated Website save/upload/readback at AAL2; no real settings were altered by tests. Review marketing/package copy and complete existing Xero certification before claiming certification.
4. Connect/publish the production domain via hosting settings; this code does not change domain/DNS configuration.
