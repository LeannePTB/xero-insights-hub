# Trixie starter library — verification

## Added articles

All 13 are active and tagged `starter`. Live database readback confirmed every title, audience and active state, plus 13 corresponding `trixie_starter_article_seeded` audit records.

1. Adding a client: Add client from Xero or New client — staff
2. Connecting, reconnecting and unlinked Xero files — staff
3. Consolidations: Groups, Loan matrix, Loan groups and Loan accounts — staff
4. Settings → Card defaults — staff
5. Monthly reports: prepare, preview, finalise and email — staff
6. People & access: invite business owners and external advisers — staff
7. Team members, ownership and support access — staff
8. Client settings tour — staff
9. Reading the Overview and seven-day changes — staff
10. Understanding Live Dashboard cards and Accrual/Cash — all
11. For business owners: your dashboard and monthly reports — viewer
12. Organisation settings, report logo and Subscription — staff
13. System Admin overview and Trixie limits and alerts — platform

## Insertion and editing

The existing super-admin save path requires a real AAL2 session, which was unavailable. The owner-authorised alternative data seed inserted article content and matching system audit entries atomically. No identities were impersonated. No policies, grants, schema, server functions, entitlements or client data were changed.

The insert-only seed uses fixed article IDs and does not overwrite existing owner edits when repeated. Content is stored in `public.trixie_knowledge`, the same table used by System Admin → Trixie → Knowledge. The owner can use Edit and Save article there. Authenticated visual readback of that screen remains unverified because the preview stopped at Two-factor required.

See `starter-help-library.md` for the full articles and their checked source files, and `starter-help-seed.sql` for the applied data seed.

## Checks

- Application tests: 164 passed, 0 failed.
- Full `security:check`: passed; 159 security tests, 1,886 access proofs and 18 live access tests passed.
- Automatic harness build: `build OK` at 2026-10-11 01:17:09 UTC. Builds/typechecks are harness-managed; no manual build or tsgo command was run. A separate tsgo result was not available and is not claimed.
- Every documented source-file reference exists.

## Real-route questions and unfinished verification

Three POST requests were made to `/api/trixie` with the requesting user's minted session:

1. Staff topic: “How do I set card defaults for new clients? Please cite the help article.”
2. Viewer topic: “As a business owner, how do I read my dashboard and monthly reports? Please cite the help article.”
3. Platform topic: “How do I edit Trixie allowances and spend alerts? Please cite the help article.”

All three returned HTTP 401 `SESSION_IDLE`; the browser separately stopped at `/auth/mfa-verify`. No answer or gateway request was reached, so article citations are **not verified**. The viewer-topic request was not a viewer-role test: only the requesting user's session was available, and no identity, role, MFA or activity checks were bypassed.

To finish, test with active AAL2 organisation-staff, assigned-client viewer and platform sessions. Confirm each answer cites its matching starter article and the viewer answer omits staff-only instructions. This remains required before claiming the three audience-specific live tests passed.