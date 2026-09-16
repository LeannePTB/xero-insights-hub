# Record the concurrent-limit diagnosis — no behaviour change

Owner decision, 16 September 2026: the 4 "paused by Xero (concurrent limit)" retries on the
Positive Traction file at 02:44 UTC need no fix. The badge stays as telemetry.

## What happened (confirmed from live data)

- Tenant `297a370f` ("Positive Traction"), 16 Sep: 53 calls, all in the 02:00 UTC hour
  (10:00 Perth); `last_problem = concurrent`, `rate_limited_count = 4`, last at 02:44:31 UTC.
- Day quota untouched (4,948 of 5,000 remaining); minute quota never close (30 of 60 free).
- Xero's concurrent limit (max 5 in flight per tenant) was exceeded; the app honoured
  `Retry-After`, retried, and all four requests completed. No failures, no data loss.
- Root cause: the snapshot-refresh worker caps itself at 2 in-flight calls, but that gate is
  per serverless instance; multiple backend instances plus interactive dashboard traffic are
  not counted by it, so a refresh overlapping morning use can pass 5 concurrent calls.
- First occurrence of this limit type. Previous 429s were per-minute, from the payroll retry
  loop — a different, already-fixed (in preview) problem.

## Change

1. `docs/security/monitoring.md`: add a short "Concurrent-limit 429s" note recording the
   above — cause, why it is self-resolving, and when to worry (repeated occurrences in one
   day, counts climbing, or any `day`-problem 429). No code, policy, grant or function changes.
2. `docs/security-backlog.md`: one line noting the event and the decision to monitor only.

## Not doing

- No shared cross-instance throttle (available later if occurrences repeat).
- No refresh schedule change.
- The hourly burst posture check (Action at 300 calls/file/hour) stays as is; this pattern
  (53 calls/hour) is far below it and correctly did not fire.

## Verification

- Docs-only change. `bun run security:check` must remain green (100+ checks, fingerprint
  unchanged) to prove nothing else moved.
