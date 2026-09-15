# Xero rate-limit visibility

Separate from the card-model migration. No file it touches is shared: this is
`src/lib/xero/*`, a new telemetry table and a new posture card. Batch 3 of the
card model stays as it is.

Classification: **SECURITY-RELEVANT** — new table holding Xero telemetry, new
definer functions, `supabaseAdmin` write path, Path C read.

## What Xero gives us (confirmed from Xero's current documentation)

Every successful response carries `X-DayLimit-Remaining`, `X-MinLimit-Remaining`
and `X-AppMinLimit-Remaining`. A 429 carries `X-Rate-Limit-Problem` (`minute` or
`day`) and `Retry-After` in seconds. Limits are 60 calls/minute and 5,000
calls/day per organisation, 10,000/minute across all organisations.

We record what Xero reports. We never maintain our own counter of the quota.

## 1. Table `public.xero_rate_limits` — telemetry, shaped like `xero_api_errors`

One row per Xero file per UTC day, updated in place: lowest remaining seen for
each of the three limits and when each low point occurred, calls observed,
rate-limit rejections, last problem and last retry-after, plus a rolling
current-hour counter and the peak hour of the day (for the burst check).
30-day retention pruned on write. Nothing from a client's data, no tokens, no
headers stored verbatim beyond the numbers.

RLS on, all privileges revoked from `anon` and `authenticated`, one `SELECT`
policy `to authenticated` requiring aal2 and super admin (Path C metadata).
No insert/update/delete policy at all — the only write path is the definer
function below.

## 2. Write path

`public.log_xero_rate_limit(...)` — `SECURITY DEFINER`, execute revoked from
`PUBLIC`, `anon` and `authenticated`, called only through `supabaseAdmin` from
the Xero request helpers. Same swallow-and-log discipline as
`log_xero_api_error`: a telemetry failure never breaks a Xero call. Nothing is
written to `audit_log`.

## 3. Capture points

`src/lib/xero/api.server.ts` only — the accounting, assets and payroll helpers
and the token-refresh path. Every response, success or failure, including the
nightly snapshot refresh which runs through the same helpers. Identity endpoints
(`/connections`) are not tenant-scoped and are noted, not attributed.

## 4. Reads

- `public.xero_rate_limit_posture()` — aal2 + super admin, returns the posture
  card: Warn under 20% remaining on any limit, Action under 5%, on any rejection
  in the last 24 hours, or on a burst. Figures come from the table.
- `public.xero_rate_limit_usage()` — aal2 + super admin, per-file rows for a new
  card on the admin screen.

## 5. Burst threshold

Proposed **300 calls per file per hour** as an Action. Today's real usage is
~130 grouped reads a day across 12 files; the one heavy day (1,257) was the
owner's own development work. 300 in one hour for a single file is roughly 6% of
that file's daily quota in an hour, an order of magnitude above any legitimate
refresh, and still only 5 calls a minute so it never trips Xero's own minute
cap. A runaway retry loop passes it within minutes.

## 6. Behaviour on a 429

Today: the accounting helper retries up to three times, honouring `Retry-After`
capped at 60 seconds, otherwise 2/4/8 seconds; assets and payroll retry once,
capped at 10 seconds. Change: record the rejection, and when
`X-Rate-Limit-Problem` is `day` stop immediately with a clear message rather
than retrying — a daily-limit rejection cannot recover inside a request and
retrying it burns the same quota.

## Verification

`bun run security:check` (fingerprint, register, tests, live access), typecheck,
Supabase linter, matrix rows unchanged, backlog and docs updated in the same
change.
