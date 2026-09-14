# Injection review — fix, then make the checks permanent

Classification: SECURITY-RELEVANT (public route rendering, embeds, exports, response headers, posture check). No access rule, policy, grant or predicate changes.

## Audit result in short

- **Cross-site scripting:** no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML` or `insertAdjacentHTML` anywhere in `src`. All untrusted text (client names, notes, comments, display names, report content) is rendered as JSX text. `react-markdown` is used once, on repo documentation, without `rehype-raw`, so embedded HTML is not rendered. Clean — needs a guard so it stays clean.
- **Loom embed:** the validator parses the URL, requires http(s), requires host `loom.com` or a `.loom.com` subdomain, and requires the path to be exactly `/share/<id>` or `/embed/<id>` with an alphanumeric id. The iframe `src` is rebuilt from the id, never from the stored string. Gap: the iframe carries no `sandbox`, no `allow` and no `referrerPolicy`.
- **CSV in:** 5 MB cap, no row cap. **CSV out:** the audit export escapes quotes, commas and newlines but does **not** neutralise formula injection (`=`, `+`, `-`, `@`, tab, CR).
- **SQL:** no string-built SQL in app code. All 154 SECURITY DEFINER functions carry `SET search_path` (confirmed by query). The 11 bodies containing `||` concatenate arrays, JSONB and evidence text — none of them EXECUTE it. Dynamic SQL exists only in migration DO blocks over catalogue names via `format(%I)`.
- **Server-function input validation:** 65 modules use `createServerFn`; only 5 import Zod. The rest use typed pass-through validators, which are compile-time only. Too large for this turn — backlog item with SLA.
- **Response headers:** already served on the live domain — HSTS, nosniff, referrer-policy, X-Frame-Options DENY, permissions-policy, and CSP in **report-only** mode with `script-src 'unsafe-inline'`. Not an absence; a permissive/unenforced CSP. Backlog item for enforcement.
- **Search:** query trimmed, capped at 200 characters, dates regex-checked, paging clamped. Only `"` is escaped before the Xero where clause; a backslash or control character is passed through.
- **Uploads:** private bucket, PNG/JPEG allow-list, 2 MB cap, server-generated filenames, read back only through a 300-second signed URL. Clean.

## Fixes this turn (cheap and safe)

1. Shared `src/lib/csv.ts` — one `csvCell` that neutralises formula-leading characters and quotes properly; the audit export uses it.
2. Loom iframe gets `sandbox`, a restrictive `allow` and `referrerPolicy`.
3. Statement upload gains row and line-length caps.
4. The search escaper drops backslashes and control characters as well as quotes.

## Permanent coverage (the point)

- `tests/static-guards.test.ts`: new guards failing the build on a new raw-HTML sink, a `rehype-raw` import, an iframe `src` not built by the approved Loom builder, string-built SQL in app code, and a CSV/export writer that does not use the shared cell escaper.
- `tests/injection.test.ts`: the Loom validator asserted against `javascript:`, `data:`, userinfo (`https://loom.com@evil.example`), lookalike hosts, scheme-relative URLs and an open-redirect Loom path; the CSV escaper asserted against every formula-leading character.
- `security_posture()` gains `http_headers`: the server reads its own public origin and reports the headers actually served — Action if no CSP at all, Warn if present but report-only or permissive.
- Everything runs under `bun run security:check` (already runs `vitest run tests`) and is documented in a new `docs/security/automated-checks.md`.

## Backlog (numbered, with SLA severity)

48. Zod validation on server-function inputs — 60 of 65 modules (High, 90 days).
49. Enforce CSP (leave report-only, remove `unsafe-inline`) — (Medium, 180 days).
