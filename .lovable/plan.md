# Audit View As and remember payroll availability

## Classification

**SECURITY-RELEVANT.** View As touches impersonation, MFA, roles and audit records. Payroll capability touches Xero connection metadata and client-facing financial cards. No access path will be widened.

## Current behaviour established before changes

- **View As is audited now.** `public.record_view_as` checks AAL2, then super-admin status, then requires an existing active organisation membership; client previews additionally use the normal client-read predicate. Only after those checks does it write `audit_log.action = 'view_as_started'` with actor, organisation, optional client, mode and database time. It does not change identity, roles, membership or RLS, so `super_admin` alone still grants no organisation or client data.
- The live audit log currently contains **zero** `view_as_started` rows. Earlier View As was only a URL filter and was not audited, so there is no record of any use before the audited control was introduced.
- The screen already shows a sticky amber **VIEWING AS** banner with an **Exit preview** control.
- Payroll calls currently key only off granted OAuth scopes. All affected files have the payroll scope string even when the Xero organisation has no payroll product/access, so the nightly refresh and live fallback keep trying `Payroll/PayRuns`.
- A payroll 401 is treated as a possibly expired token: the shared helper refreshes the token and retries once. A 429 also retries once. Separate dashboard/card/capability/manual-refresh requests have separate request-local memoisation, so repeated invocations can each issue their own initial call and retry. That is how development activity produced the 24-call burst; the nightly job then repeated one failed report per affected file each day.

## Implementation

### 1. Preserve and strengthen View As evidence

- Keep the existing database function and its AAL2, super-admin, existing-membership, same-organisation and normal client-read checks unchanged.
- Expand matrix coverage so staff, support-grant holders, external advisers, business owners/owners, AAL1 sessions and super admins without membership are explicitly refused; prove an eligible super-admin member succeeds and that exactly one audit row is written with no client data in `meta`.
- Keep the existing obvious banner and Exit preview control. No authorisation or visibility change.

### 2. Persist payroll capability per Xero connection

- Add connection metadata fields for payroll capability: `unknown`, `available`, or `unavailable`, plus checked time and a non-sensitive reason/status. Tokens and payroll payloads are never stored in these fields.
- Update capability only from the server-side Xero response. A successful PayRuns response records `available`; a definitive 401/403 from the payroll endpoint records `unavailable` without changing the connection's connected status.
- Before any payroll call, skip files recorded `unavailable` until their check is due. Re-probe **once every 7 days**: frequent enough to discover a newly added payroll subscription within a week, while avoiding daily predictable refusals and preserving quota.
- Reset payroll capability to `unknown` after a successful reconnect/authorisation update so newly granted payroll becomes available immediately rather than waiting seven days.
- Keep ordinary accounting sync active; missing payroll never disconnects a healthy Xero file.

### 3. Show an explicit card state

- Keep PAYG withholding and superannuation cards visible when purchased and ticked.
- For a file known to lack payroll, show a clear neutral message: **“This Xero file does not have payroll, so payroll figures are not available.”** Do not show zero, an error/retry prompt, or silently hide the cards.
- Balance-sheet information may still render where meaningful, but payroll-derived explanations/monthly figures use the explicit unavailable state.

### 4. Burst protection and verification

- Keep Xero’s normal rate-limit telemetry and add tests proving a known payroll-unavailable file makes no call before the seven-day recheck and at most one capability probe when due.
- Verify the hourly posture check still raises Action above 300 calls per file in an hour. Note: its telemetry began after the 8 September incident, so historical rows cannot retroactively populate that counter; the same pattern now would be counted on every response and caught within the hour once it crosses 300.
- Run `bun run security:check`, verify the access-matrix fingerprint and totals, run the database linter and `public.security_posture()`, and update the security backlog with the root cause, interval decision, card behaviour and evidence.

## Security invariants

- View As remains a presentation filter only; `super_admin` alone grants zero organisation/client access.
- No support, adviser, staff or business-owner access changes.
- Xero tokens and payroll data remain server-only; capability metadata contains no payroll payload or personal information.
- `audit_log` receives only the View As security event, never Xero operational telemetry.
