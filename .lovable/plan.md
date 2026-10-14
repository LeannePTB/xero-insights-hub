# Public sales page and website settings

## Build
- Replace the signed-out `/` redirect with a practices-first Traction Advisory sales page, with all ten requested sections and a business-owner section.
- Keep `/auth` unchanged and send existing sessions through the current protected workspace landing resolver, including MFA.
- Use official brand tokens and fonts, synthetic screenshot-style imagery, accessible mobile layouts and reduced-motion video handling. No real client data appears publicly.
- Add demo/request-access and existing Xero signup actions. Empty video and price settings stay hidden.
- Include `/`, `/privacy`, `/terms` and `/security` in the sitemap and permit crawling; add page-specific search and sharing metadata.

## Website settings
- Add a Website section to Platform branding for Calendly, MP4/poster uploads, validated Loom/YouTube embeds and four optional price labels.
- Preserve existing branding save/read behaviour. Extend the same grant-free branding table with public website fields, a narrow anonymous reader and an audited System Administrator-only AAL2 save function.
- Use a dedicated public media bucket with bounded file sizes and AAL2 System Administrator-only upload permissions. Client and organisation data access stays unchanged.

## Security and verification
Classification: website presentation is public-only; website settings/storage are security-relevant. Threats: unauthorised website changes, unsafe URLs/embeds, unrestricted uploads and accidental public data exposure. Invariants: deny by default, server/database MFA, database-only role checks, no client-data privileges, no secrets, audited writes.
- Prove anonymous public-field reads, denied direct table writes, non-admin/AAL1 save denial and audited AAL2 admin save in synthetic database tests; validate URL hosts and upload limits.
- Refresh matrix, signatures and definer evidence; run focused tests and the full security gate. Check current build diagnostics and desktop/mobile interactions.
- Report any unavailable authenticated save/readback or posture/linter evidence honestly.

## Owner supplies
Calendly link, final videos/poster, Demo Practice screenshots and optional prices. Until supplied, use request-access fallback, synthetic visuals, no walkthrough and no prices. Copy is draft marketing copy, not new contractual promises.