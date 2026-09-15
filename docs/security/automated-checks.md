# Register of automated security checks

Every check here runs on every change through `bun run security:check`
(`./scripts/check-fixture-fingerprint.sh && render-access-matrix --check &&
definer-register --check && vitest run tests && run-live-access-tests`), or on
every load of the Security card (`public.security_posture()` plus the
TypeScript posture checks in `src/lib/security-posture.functions.ts`).

The point of this file is that the coverage itself is documented: a check that
nobody remembers is not a control.

## Build-failing static guards — `tests/static-guards.test.ts`

| # | Guard | What it catches |
| - | ----- | --------------- |
| 1 | Every server function requires aal2 | A new `createServerFn` that skips MFA and is not in the recorded allow-list |
| 2 | Every `supabaseAdmin` use is registered | A new privileged client use with no verified reason |
| 3 | Identity never from `profiles.email` | An identity or recipient decision made on a self-editable field |
| 4 | `tenant_id` never from the request | A caller-supplied Xero file id used as a grant |
| 5 | Readable access matrix matches its source | Evidence drifting from the policies it documents |
| 6 | Converted files decide nothing themselves | An access decision re-implemented in TypeScript |
| 7 | Client-data reads are audited | A new read path that writes no audit row |
| 8 | Standing viewer grant is never a write path | An External adviser gaining write capability |
| 9 | Relationship labels grant no authority | A display label used as an access decision |
| 11 | Read predicates never authorise a write or payment | `has_client_access` and friends returning to a write or billing path |
| 12 | No raw-HTML sink | A new `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` with no recorded reason; also a `rehype-raw` import, which would make markdown render embedded HTML |
| 12b | Iframe `src` comes from the approved builder | Any iframe other than the one Loom embed, and that one losing its `sandbox` or `referrerPolicy` |
| 12c | No string-built SQL in app code | `execute format(...)`, an interpolated statement, or an `exec_sql`-style RPC |
| 12d | Every CSV writer uses the shared escaper | A new export building its own cells, and any second implementation of a cell escaper |

## Behaviour tests — `tests/injection.test.ts`

- **Loom URL validator (`parseLoomId`)** asserted to reject: `javascript:`,
  `data:`, `file:`, userinfo tricks (`https://loom.com@evil.example`, with and
  without a password), lookalike hosts (`loom.com.evil.example`, `notloom.com`,
  `l00m.com`), scheme-relative and bare-path URLs, an open redirect on a real
  Loom path, a redirect endpoint on the real host, path traversal and encoded
  traversal in the id, ids that are too short or carry punctuation, and extra
  path segments. Genuine share and embed links are asserted to return the id
  alone, and the id is asserted alphanumeric so it cannot break out of the
  embed URL it is interpolated into.
- **CSV cell escaper (`csvCell`)** asserted to neutralise every
  formula-leading character (`=`, `+`, `-`, `@`, tab, CR), including
  `=HYPERLINK(...)` and `=cmd|'/C calc'!A0`, to quote separators and double
  inner quotes, and to leave ordinary values untouched.

## Posture checks read at runtime

| Check | Reads | Action / Warn |
| ----- | ----- | ------------- |
| `tls_hsts` | `HEAD` on the canonical public origin | Warn when HTTPS or HSTS is not observed |
| `session_controls` | `public.session_controls_posture()` reads the live source of `app_private.is_session_active`, `is_aal2` and `assert_aal2` | **Action** when the inactivity window cannot be read, when the aal2 gate no longer consults the idle or daily-cut-off check, when `assert_aal2` no longer raises `SESSION_IDLE`, or when `touch_session_activity` is not a definer function |
| `http_headers` | `HEAD` on the canonical public origin | **Action** when no CSP at all, or when nosniff, referrer-policy or framing protection is missing; **Warn** when CSP is present but report-only or allows `'unsafe-inline'` / `'unsafe-eval'` |
| `aal2_tables`, `definer_guards`, `read_audit_posture`, `test_accounts_posture`, … | Live catalogue and audit trail | See `supabase/migrations` (`public.security_posture()`) |

`http_headers` reads the headers actually served — there is no hard-coded pass,
and an unreachable origin reports Warn ("not verified"), never OK.

### Documented exclusions (the complete list)

Nothing is excluded silently: every exclusion is named in the evidence text on
the card itself, so an assessor reading the Security page sees the reason
without reading the source.

| Check | Excluded | Why |
| ----- | -------- | --- |
| `definer_guards` | `public.xero_required_scopes()` | A constant list of Xero scope strings; reads no table and returns no data. |
| `definer_guards` | `public.session_is_active()` | `app_private.is_aal2()` calls it to decide whether a session is idle, so asserting aal2 inside it would be circular. It returns one boolean about the calling session and no data. |
| `aal2_tables` | `public.session_activity` | `app_private.is_aal2()` reads this table to decide whether a session is idle, so a restrictive aal2 policy on it would be circular. It keeps RLS on, grants nothing to `anon`, is readable only on the caller's own row, holds no organisation, client or Xero data (a session id, a user id and a timestamp), and is written solely by `public.touch_session_activity()` — signed-in users hold no INSERT, UPDATE or DELETE privilege on it. |
| `aal2_tables`, `using_true` | `plan_levels`, `tier_settings` | Deliberately readable plan catalogues; no organisation, client or personal data. |
