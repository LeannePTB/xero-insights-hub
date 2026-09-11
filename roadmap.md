# Roadmap

- [ ] Replace role-check authorisation with access checks on write paths (plan in .lovable/plan.md awaiting approval; five open questions)
- [ ] Phase 2 — Guardrails: access matrix, PGlite matrix suite, live smoke suite with dedicated test accounts, static guard tests, verified admin-client register, definer_guards tightening + access_tests posture check
- [x] Fix the firm-subscription super_admin bypass (`resolveAccess`/`assertAccess`)
- [x] Add Allyce and Chantelle as staff of Autotek NSW and Bangkok On Darby (Path A membership)
- [x] Phase 1 — enforce MFA (aal2) on the server: middleware wrapper, restrictive policies on all 49 in-scope tables, guards on 26 definer functions
- [x] Phase 1b — Security posture card in the left sidebar (live checks, online chips, shared with /admin/security)
- [x] Phase 1b corrections — presence for everyone, server-set last active, restored token/PKCE/TLS/HIBP checks, requested card design
- [x] Security posture follow-up — verified names, profile column grants, presence grants, and audit check
