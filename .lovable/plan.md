# Stage 3 — Populate snapshots on a schedule (writes only, nothing reads)

Stage 3 fills `xero_snapshots` / `xero_snapshot_runs`. It is the first thing in this project that holds Xero credentials outside a user request and the first publicly reachable route we have added since the Xero callback. Nothing on screen changes.

New files:
- `src/routes/api/public/xero/snapshot-refresh.ts` — the cron-called route
- `src/lib/xero/snapshot-refresh.server.ts` — the refresh worker
- `src/lib/xero/snapshot-keys.ts` — `report_key` catalogue, `params_hash`, staleness thresholds (the single constants file agreed earlier)

Requires approval: one `pg_cron` schedule and one new database function (the claim RPC in section 2). No new tables.

## 1. The public route and its authentication

Path: `POST /api/public/xero/snapshot-refresh`.

It follows `src/routes/lovable/email/queue/process.ts` exactly: `pg_cron` sends `Authorization: Bearer <service role key>` via `net.http_post`, the handler compares the bearer against `process.env.SUPABASE_SERVICE_ROLE_KEY`, and the key is read from the vault inside the cron body (`vault.decrypted_secrets`) rather than pasted into the schedule, the same way `email_queue_dispatch` does it. No new secret is created.

- Missing or malformed header → `401 {"error":"Unauthorized"}`. Wrong token → `403 {"error":"Forbidden"}`. Neither response says anything about what was expected, and neither touches Xero.
- **Deviation from the email pattern, deliberate:** the comparison will be constant-time (`crypto.timingSafeEqual` over `Buffer.from` of both strings, length-checked first), not `!==`. The email route uses `!==`. A timing oracle on a service role key is a bad trade for nothing, and unlike the email route this one can spend a shared, exhaustible resource.
- **Second deviation:** the email route does the work on any authorised call. This one refuses to do work too often regardless of authorisation. Before touching Xero it calls the existing `public.check_rate_limit('xero_snapshot_refresh_global', 4, 3600)` — at most 4 global runs an hour — and, per tenant, `check_rate_limit('xero_snapshot_tenant:' || tenant_id, 2, 3600)`. A caller who somehow holds the key still cannot loop the route to burn quota; the second call in a tick returns `{skipped: true, reason: 'throttled'}` having made zero Xero requests.

Can an attacker use it to burn the app-wide daily quota? Only with the service role key, which is not in the browser bundle, not in `VITE_*`, and not reachable through the app. Without it they get a 401/403 before any code runs. With it, the two rate-limit buckets above cap the damage at roughly 4 runs an hour whatever they do — and someone holding that key has far worse options than exhausting a Xero quota.

## 2. The claim/lock mechanism

A tenant is claimed by inserting its `xero_snapshot_runs` row under a transactional advisory lock, so the claim and the "is one already running" check cannot interleave. New database function (needs approval):

```sql
CREATE OR REPLACE FUNCTION public.claim_xero_snapshot_run(
  _client_id uuid, _firm_id uuid, _tenant_id text, _trigger text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_run_id uuid;
BEGIN
  -- One waiter per tenant; a second tick for the same tenant returns NULL.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('xero_snapshot:' || _tenant_id, 0)) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.xero_snapshot_runs
     WHERE tenant_id = _tenant_id
       AND status = 'running'
       AND started_at > now() - interval '24 hours'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.xero_snapshot_runs (client_id, firm_id, tenant_id, trigger, status)
  VALUES (_client_id, _firm_id, _tenant_id, _trigger, 'running')
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_xero_snapshot_run(uuid, uuid, text, text)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_xero_snapshot_run(uuid, uuid, text, text) TO service_role;
```

`NULL` means "someone else has it" and the worker moves to the next tenant. `SKIP LOCKED` over a queue table would be the alternative, but there is no queue table and Stage 2 did not create one — the advisory lock gets the same guarantee with no new object.

If a run dies mid-flight (worker killed, Worker CPU limit, network drop) the row stays `status='running'` with `finished_at IS NULL`. Two things unblock it: the `started_at > now() - interval '24 hours'` predicate above, which makes the stale claim stop blocking after 24 hours even if nothing cleans up; and `public.prune_xero_snapshot_runs()` from Stage 2, whose second clause is exactly `status = 'running' AND started_at < now() - make_interval(hours => _abandoned_hours)` with a 24-hour default. Confirmed: the abandoned-run sweep covers this case. The two windows are deliberately the same 24 hours, and Stage 3 will call the prune function once at the start of each nightly run — that is the first caller of it, and it is a call, not a schedule.

## 3. Reports refreshed, and the call arithmetic

Per tenant, overnight tier (`refresh: 'daily'`):

| report_key | Xero endpoint | calls |
|---|---|---|
| `balance_sheet` | `Reports/BalanceSheet` | 1 |
| `balance_sheet_prior` | `Reports/BalanceSheet` (prior month) | 1 |
| `profit_and_loss_mtd` | `Reports/ProfitAndLoss` | 1 |
| `profit_and_loss_prior` | `Reports/ProfitAndLoss` | 1 |
| `profit_and_loss_ytd` | `Reports/ProfitAndLoss` | 1 |
| `trial_balance` | `Reports/TrialBalance` | 1 |
| `bank_summary` | `Reports/BankSummary` | 1 |
| `accounts` | `Accounts` | 1 |
| `organisation` | `Organisations` | 1 |

Nine calls per tenant per night.

Hourly tier (`refresh: 'hourly'`):

| report_key | Xero endpoint | calls |
|---|---|---|
| `aged_receivables` | `Reports/AgedReceivablesByContact` | 1 |
| `aged_payables` | `Reports/AgedPayablesByContact` | 1 |
| `invoices_accrec_open` | `Invoices` (ACCREC, unpaid) | 1 |

Three calls per tenant per hourly tick.

Daily total at 20 tenants:
- overnight: 20 × 9 = **180**
- hourly at 24 ticks: 20 × 3 × 24 = **1,440**
- total: **1,620/day** against the app-wide 10,000/day, leaving **8,380** — about 84% headroom for live dashboard traffic and the monthly report, which stay live.

Per tenant this is 9 + 72 = 81 calls/day against 5,000, which is not close to a limit.

Hourly receivables for 20 tenants fits, but I want to be honest about where it stops fitting: hourly is 1,440 calls/day at 20 tenants and scales linearly, so at ~60 tenants the hourly tier alone is 4,320/day and the headroom for live traffic gets thin. The thresholds live in one constants file precisely so hourly can become two-hourly without a migration. I would also restrict the hourly tier to business hours (say 06:00–20:00 AEST, 15 ticks) at the point we pass 30 tenants; that is a constant change, not a rebuild.

## 4. Concurrency against the 5-concurrent app-wide limit

The worker processes tenants **sequentially**, one report at a time — concurrency 1 from the scheduled job, not 5. That is deliberate: 9 calls at roughly 300–600 ms each is a few seconds per tenant, and 20 tenants comfortably fits one nightly window. Trading throughput we do not need for headroom we do is the right way round.

That leaves 4 of the 5 concurrent slots for live user traffic at all times, so a scheduled run and a user's dashboard cannot collide into the limit. A user-triggered "Refresh now" (Stage 5's button; the worker function ships in Stage 3 but is called by nothing) takes the same per-tenant advisory lock, so it cannot run alongside a scheduled refresh of the same tenant — it returns "a refresh is already running" instead. Across different tenants, the worst case is one scheduled run plus a handful of manual ones; a small global in-process concurrency gate in `snapshot-refresh.server.ts` caps total in-flight refresh calls at 2, leaving 3 slots for interactive traffic. `xeroGet`'s existing 429 backoff and `Retry-After` handling stays exactly as it is and is the second line of defence.

Staggering: tenants are ordered by `hashtextextended(tenant_id, 0)` and the nightly job spaces them, so the same tenant is not always first, and 20 organisations never fire simultaneously — they fire one after another by construction.

## 5. Token handling outside a request context

The worker calls the existing `getConnectionByTenant(tenantId)` in `src/lib/xero/api.server.ts`. It already does everything needed and I am not writing a second token path:

- it selects the connection with `supabaseAdmin` (no user session required, which is the whole point here), decrypts with `TOKEN_ENC_KEY`, and refreshes when the token is within 60 seconds of expiry, so the 30-minute expiry is handled without the job knowing about it;
- **rotation:** Xero issues tokens per *user*, not per tenant, and `refreshAccessToken` writes the rotated pair to every connection for that `user_id`. That matters here in a way it does not in a request: one user can own several tenants, and refreshing two of them in parallel would race the rotating refresh token. Sequential processing (section 4) removes the race, and the existing recovery path — re-read the latest row and use it if its refresh token has changed and it is still valid — covers the residual case where a user's dashboard refreshes at the same moment;
- **`invalid_grant`:** already handled — the connection (and every sibling for that user) is set `status='disconnected'`, an `xero_reconnect_required` audit row is written, and the call throws. The worker catches that, marks the run `failed`, writes nothing to `xero_snapshots`, and skips the tenant on subsequent ticks because `getConnectionByTenant` filters `status='connected'`. No retry loop, per spec section 10.

No token is logged. The worker logs `tenant_id`, `report_key`, HTTP status and duration only; Xero API failures go through `public.log_xero_api_error(...)`, which per spec section 9 never receives tokens, headers or payloads.

**Stage 1 memo:** `storeForCurrentRequest()` calls `getRequest()` inside a `try` and returns `null` when there is no request context, and `memoiseXeroGet` then runs the fetcher uncached. The cron route *does* have a request context, so the memo will be live for the duration of one refresh tick — which is correct and harmless: within one tick, two identical `(tenant, endpoint, params)` calls genuinely are one report. The intended no-op is the other direction: if the worker is ever invoked outside a request, it degrades to uncached rather than sharing a memo across tenants. Both behaviours are intended, and the memo can never span tenants because `tenant_id` is the second field of the key.

## 6. Writes

Per report, on success:

```sql
INSERT INTO public.xero_snapshots
  (client_id, firm_id, tenant_id, report_key, params_hash, params,
   source_endpoint, payload, payload_version, as_at, fetched_at, complete, run_id)
VALUES (...)
ON CONFLICT (client_id, tenant_id, report_key, params_hash) DO UPDATE
SET payload         = excluded.payload,
    params          = excluded.params,
    source_endpoint = excluded.source_endpoint,
    payload_version = excluded.payload_version,
    as_at           = excluded.as_at,
    fetched_at      = excluded.fetched_at,
    complete        = excluded.complete,
    run_id          = excluded.run_id
WHERE excluded.fetched_at > public.xero_snapshots.fetched_at;
```

The `ON CONFLICT` target is the Stage 2 unique constraint `(client_id, tenant_id, report_key, params_hash)`. The `WHERE excluded.fetched_at > ...` guard is what stops a slow response from an earlier tick overwriting a newer row: `fetched_at` is stamped when the Xero response arrives, not when the insert runs, so a straggler is silently dropped rather than winning.

- **Failed report:** nothing is written for that `report_key`. No row is deleted, no row is marked incomplete. The previous good row stays exactly as it was and simply ages — which the UI will later surface as staleness. This is the important one: a failure never degrades data we already hold.
- **Partial failure:** the run row gets `status='partial'` with `reports_succeeded` / `reports_failed` and `error` set to a short summary. Successful reports are written; failed ones are not. Because the completeness signal lives on the run and each snapshot row carries its own `fetched_at`, a partial refresh can never be read as a complete picture — Stage 5's reader compares row ages against the thresholds file, not against "the last run finished".
- **Total failure** (token dead, tenant unreachable): `status='failed'`, `reports_succeeded = 0`, `error` set, `finished_at` stamped. No snapshot writes at all.

`complete` on the snapshot row describes that single report's payload (e.g. a report Xero returned with a truncation marker), not the run.

## 7. What Stage 3 does not do

Nothing reads these snapshots. No widget imports the new modules, no query key changes, `ClientHealthBadge` is untouched, the monthly management report stays live and unchanged, Transaction Search stays live. Every figure on screen after Stage 3 comes from the same live Xero call it comes from today. Stage 3 populates; Stage 5 reads. The "Refresh now" entry point exists as a server function but is wired to no button.

## 8. Observability and the kill switch

- `xero_snapshot_runs` is the record: one row per tenant per attempt with `status`, counts, `duration_ms` and `error`. `select status, count(*), avg(duration_ms) from xero_snapshot_runs where started_at > now() - interval '1 day' group by 1` answers "did it run and what did it cost".
- Xero-side cost: `sum(reports_succeeded + reports_failed)` over a day is the exact call count, cross-checkable against `xero_api_errors` for the failure side.
- `cron.job_run_details` shows whether the schedule itself fired.
- **Kill switch, no deploy:** `select cron.alter_job((select jobid from cron.job where jobname='xero-snapshot-refresh-nightly'), active := false);` — takes effect on the next tick, reversible with `active := true`. Same for the hourly job. A harder stop, if the route itself must be silenced, is `select public.check_rate_limit('xero_snapshot_refresh_global', 0, 86400);`-style poisoning of the bucket, but disabling the cron job is the clean one. Neither needs a deploy or a migration.

## 9. Rollback

```sql
SELECT cron.unschedule('xero-snapshot-refresh-nightly');
SELECT cron.unschedule('xero-snapshot-refresh-hourly');
DROP FUNCTION IF EXISTS public.claim_xero_snapshot_run(uuid, uuid, text, text);
TRUNCATE public.xero_snapshots, public.xero_snapshot_runs;  -- optional; data only
```

Plus deleting the three new files. That leaves Stage 1 (the request memo in `src/lib/xero/request-memo.server.ts` and `api.server.ts`) untouched — it has no dependency on any of this — and Stage 2's tables, policies, indexes and `prune_xero_snapshot_runs` intact and back to inert. No existing file is modified by Stage 3 except the route tree, which regenerates, so there is nothing to unpick in `api.server.ts` or any widget.

## 10. The 3am quota-exhaustion failure mode

What specifically prevents it, in order of how much I trust each:

1. **The work is bounded by construction, not by a guard.** The worker enumerates tenants once from `xero_connections` and iterates a fixed nine-item report list. There is no loop whose length depends on Xero's response, no pagination follow-on in the overnight tier, and no retry-on-failure beyond `xeroGet`'s existing 3 attempts. The upper bound of one nightly run is tenants × 9. For it to spend 10,000 calls, something would have to invent tenants.
2. **The run cannot repeat.** `claim_xero_snapshot_run` refuses a second concurrent run per tenant, and the global bucket caps the route at 4 runs an hour. A cron misfire storm therefore costs at most 4 × 180 = 720 calls in an hour, not unbounded.
3. **Sequential execution with a concurrency cap of 2** means even a runaway is slow — 300–600 ms per call is roughly 6,000–12,000 calls in a whole hour at absolute best, and the bucket has already stopped it long before.
4. **`xeroGet`'s 429 backoff** means Xero pushing back slows us rather than being retried through.

Blast radius if the guard fails: guards 1 and 2 fail independently, so the realistic bad case is one of them, and the other still bounds the run. If *both* failed — a bug that both loses the report-list bound and defeats the rate-limit bucket — the job could consume the app-wide 10,000/day, and the consequence is that every organisation's live dashboards return 429 for the remainder of the UTC day, including the twenty onboarding. That is a full-product outage, not a degradation, because nothing reads snapshots yet and everything on screen is still live.

Two things I would add because of that. First, a hard per-run call ceiling in `snapshot-refresh.server.ts` — a counter incremented on every `xeroGet` from the worker, aborting the run at 400 calls — so the bound is enforced by a number rather than by the loop being correct. Second, running the nightly job at a fixed low-traffic hour with the hourly tier disabled for the first week, so if it does misbehave it does so once, at 3am, with a day's worth of evidence in `xero_snapshot_runs` before it can do it again.

## Approval needed

- One database function: `public.claim_xero_snapshot_run` (migration).
- Two `pg_cron` schedules: `xero-snapshot-refresh-nightly` and `xero-snapshot-refresh-hourly` (run_sql, not a migration — they carry the URL and vault lookup).
- One public route and two new library files.

No new tables, no new columns, no RLS changes.
