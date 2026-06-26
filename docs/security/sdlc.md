# Secure SDLC

## Source control

- All code lives in a private repository managed via Lovable.
- Production secrets are never committed; they live in Lovable Cloud secrets.
- The `client.server.ts` admin Supabase client may only be imported from `*.server.ts` files or loaded with `await import(...)` inside server-function handlers, never at module scope of client-reachable files.

## Review

- All changes touching auth, RLS, encryption, or Xero code are reviewed by a second person before deploy.
- Database migrations are reviewed and approved before they run.

## Deployment

- Lovable Cloud handles deployment. Preview environments are protected by the same auth gate as production.
- Production releases are tagged with the Lovable build ID for traceability.

## Server hardening

We do not operate self-managed servers or OS images. The application runtime is a managed Cloudflare Workers environment and the database is managed Supabase Postgres. Server hardening follows the vendor-specific standards published by these providers:

- Cloudflare Workers platform security: https://developers.cloudflare.com/workers/platform/security/
- Supabase platform security & hardening: https://supabase.com/docs/guides/platform/security

Application-side hardening we control:

- HTTPS enforced end-to-end via Cloudflare; HSTS preload header set.
- All Postgres tables enabled for Row-Level Security; explicit `GRANT`s per role.
- Service-role key never imported into client-reachable code.
- Authenticated routes require MFA (AAL2) before rendering.
- Strict security headers on every response: `x-content-type-options`, `referrer-policy`, `x-frame-options: DENY`, `permissions-policy`, and a CSP report-only policy.

## Secrets

| Secret | Where |
| --- | --- |
| `TOKEN_ENC_KEY` | Lovable Cloud, server-only. Used to AES-256-GCM wrap Xero tokens. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Lovable Cloud, server-only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Lovable Cloud managed; never used in client-reachable reads. |

## Testing

- Schema changes are validated by the Supabase linter immediately after each migration.
- The Lovable security scanner runs on every change and surfaces RLS / GRANT issues for review.
