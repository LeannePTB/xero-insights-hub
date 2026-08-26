# Stage 4 — Rules engine over snapshots, and a ranked verdict badge

Build a small rules engine that reads only stored snapshots, then replace the composite
health score on the **client list badge** with a ranked verdict. Staff-only. No Xero calls.
No new database objects.

## 1. What the badge can say from what we store

The catalogue in `src/lib/xero/snapshot-keys.ts` stores raw Xero payloads only — there is no
`health` key and nothing pre-computed. Assessment of the four rules:

- **R01 protected money vs cash — SOLID.** `balance_sheet` gives both sides. The Balance Sheet
  rows feed the existing `extractTaxLines` walker in `src/lib/xero/reports.functions.ts`, and
  `buildProtectedMoney(asAtDate, lines)` already turns those into GST / PAYG / super with an
  explicit `unresolved` state. Cash at bank comes from the same Balance Sheet. Zero new Xero
  calls. The only work is exporting `extractTaxLines` (currently module-private) so the rules
  engine can call it on a stored payload instead of a live fetch.
- **R05 statutory lodgement / overdue — APPROXIMATION, ship as "balance owing", not "overdue".**
  The Balance Sheet tells us what is *accrued*; it does not tell us what has been *lodged* or
  when a lodgement is due. `Reports/ActivityStatement` does not exist in the Xero API (project
  knowledge §10), so BAS status is not obtainable. Ship it as a magnitude rule ("GST + PAYG owing
  is large relative to cash") and never use the word "overdue". A true lodgement rule needs a
  lodgement calendar we do not have; out of scope.
- **R06 debtor concentration and overdue — SOLID for ageing, SOLID for concentration, with one
  caveat.** `invoices_accrec_open` carries `DueDate`, `AmountDue` and `Contact` per invoice, so
  buckets and top-debtor share are derivable without an Aged Receivables report. Caveat: the pull
  is capped at `INVOICE_PAGE_LIMIT` (5 pages), and a truncated pull is already written with
  `complete = false`. The rule must not fire on a truncated payload — it falls to the coverage
  gate in §4.
- **R02 runway — WAIT.** `bank_summary` gives per-account cash in and cash out over the stored
  window, which is bank movement, not net burn: owner drawings, transfers between accounts and
  loan draws all read as "cash out". A runway figure built on it would be wrong in exactly the
  direction that matters. Defer R02 to a later stage and derive burn from `profit_and_loss_ytd`
  plus `profit_and_loss_prior` when we do.

**Stage 4 ships R01 and R06. R05 ships reworded as a magnitude rule. R02 does not ship.**

## 2. Severity, ranking and badge shape

Each rule returns, or returns nothing:

```text
{ ruleId, title, detail, severity: "critical"|"warning"|"watch",
  consequenceScore: 0-100, daysToConsequence: number|null, deepLink }
```

Severity is a band on `consequenceScore`, set by the rule from its own inputs (e.g. R01:
protected money exceeds cash → critical; within 25% of cash → warning). Ranking is
`consequenceScore` descending, then `daysToConsequence` ascending, then `ruleId` for a stable
order. Rules that cannot evaluate return `null` and never rank.

The badge shows the **top rule only**: a severity dot, its `title`, and — when more fired — a
`+2 more` suffix. Full ordered list goes in the tooltip. Nothing fires and coverage is good →
"No issues found". Coverage is not good → see §4.

## 3. Rules as data

**v1 uses a constants file, not a table:** `src/lib/health/rule-thresholds.ts`. Justification —
we have three rules and no tuning history, so a table would be a schema, an RLS policy, an
editor UI and a cache-invalidation story bought before we know which numbers actually move.
The file keeps every threshold in one place with one exported object per rule, so lifting it
into a table later is a read swap, not a rewrite. **A thresholds table would be a new database
object and is therefore out of scope for this stage — flag it for approval when we want it.**

## 4. Staleness and coverage gate

Evaluated before any rule runs, using `STALENESS_SECONDS` per `report_key`:

- **Stale** (newest required snapshot older than its threshold): badge reads
  "Data from {date} — refresh pending", amber, no verdict.
- **Disconnected** Xero connection (`xero_connections.status <> 'connected'`): badge reads
  "Xero disconnected — reconnect", with the reconnect link. No verdict.
- **Missing `report_key`, wrong `payload_version`, or `complete = false`**: the rules needing it
  are skipped and the badge reads "Partial data — {n} check(s) unavailable". Rules not needing
  it still run and can still show a red verdict.

**A stale or partial client can never render green.** "No issues found" is emitted only when
every required key is present, current and `complete = true`.

## 5. Retiring the score

Deleted or unrendered:

- `ClientHealthBadge` (`src/components/dashboard/ClientHealthBadge.tsx`) is rewritten: score,
  `/100`, band colours and the `BAND_STYLES` map go; the module-level concurrency semaphore goes
  with them, because there is one query for the whole list. The `Unavailable` tooltip pattern is
  kept for the §4 states.
- Its call to `getBusinessHealth` goes. `FirmClientsSection.tsx` passes a per-client verdict from
  the new list query instead of `tenantId`.

**Untouched in this stage:** the `health` widget on the client dashboard. `getBusinessHealth`,
`getBusinessHealthDetail`, `computeScore`, `scoreFromMetrics`, `statusFor`, the three pillars,
`HealthScoreDonut.tsx`, `PillarCard.tsx`, `StatusPill.tsx` and `health.recommendations.ts` all
stay exactly as they are — the dashboard widget is their only remaining caller. Nothing is
deleted from `src/lib/health.functions.ts`. Retiring the score there is a separate decision.

## 6. The query

New file `src/lib/health/verdicts.functions.ts`:

```text
listClientVerdicts({ data: { firmId, clientIds } })
  -> { verdicts: Record<clientId, Verdict> }
```

`createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`. One query against
`public.xero_snapshots` through `context.supabase`:

`select client_id, tenant_id, report_key, payload, payload_version, as_at, fetched_at, complete
 where firm_id = $1 and report_key in (…required keys…) and client_id in (…)`

which uses `xero_snapshots_firm_report_idx` on `(firm_id, report_key)`. Rows are grouped by
client in memory and each group is run through the rules. **Zero Xero calls — the module never
imports `api.server`.** A client with no snapshot rows returns
`{ state: "no_data", label: "No snapshot yet" }`, distinct from "no issues".

Evaluation itself lives in `src/lib/health/rules.server.ts` (pure functions over payloads) so it
is unit-testable without a database. `extractTaxLines` is exported from
`src/lib/xero/reports.functions.ts` for R01 to reuse; `getProtectedMoney`/`buildProtectedMoney`
stop being dead code.

## 7. Access

Reads go through `context.supabase`, never `supabaseAdmin`, so the dual-check RLS on
`xero_snapshots` applies as the caller: a staff member gets rows only for clients they are
entitled to. Because the badge is driven by the list the caller already sees, a client present
in the list but absent from the verdict result is rendered **"Unavailable"**, never blank and
never green — a permission gap and a missing snapshot must both be visible.

## 8. Call reduction

Today `ClientHealthBadge` calls `getBusinessHealth` per row: 2 Xero calls each (P&L + Balance
Sheet), throttled to 3 concurrent.

- 14 clients: **28 Xero calls → 0**
- 20 clients: **40 Xero calls → 0**

Replaced by one Postgres query for the whole list. The daily refresh already pays for the
underlying data.

## 9. Rollback

The old path is not deleted, only unwired: `getBusinessHealth` and `computeScore` stay live for
the dashboard widget. Reverting is restoring the previous `ClientHealthBadge.tsx` and the
`tenantId` prop in `FirmClientsSection.tsx` — two files, no database change, no data migration.
The rules engine can stay in the tree unused while we decide.

## 10. What Stage 4 does NOT do

No change to the client dashboard, the `health` widget, the monthly management report,
Transaction Search, or any figure a client sees. No new tables, columns, policies, triggers or
functions. No cron or refresh changes. No R02 runway rule. Staff-only; the badge is not rendered
on any client-facing surface.

## Files

- new `src/lib/health/verdicts.functions.ts` — the single list query
- new `src/lib/health/rules.server.ts` — R01, R05 (reworded), R06, ranking
- new `src/lib/health/rule-thresholds.ts` — tunable numbers
- new `src/lib/health/rules.test.ts` — fixtures per rule, plus gate cases
- edit `src/lib/xero/reports.functions.ts` — export `extractTaxLines`
- edit `src/components/dashboard/ClientHealthBadge.tsx` — verdict rendering
- edit `src/components/admin/FirmClientsSection.tsx` — one query, pass verdicts down
