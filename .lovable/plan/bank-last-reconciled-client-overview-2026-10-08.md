# Bank last reconciled — Client overview

## What you'll see

- A new **"Bank reconciled to"** column on the Client overview table, showing the date of the most recent reconciled bank transaction in each client's Xero file (e.g. "3 Oct 2026"), or "Never" / "—" when there is none.
- A **"What changed" feed item** when a client's bank has not been reconciled for **14 days or more**, so neglected files surface without you scanning the column. It clears itself once the file is reconciled again, and can be Acknowledged / Snoozed like other feed items.
- Figures appear after the next overnight refresh; no manual action needed.

## How it works

- The nightly refresh already holds the Xero permission needed (`accounting.banktransactions.read`). It will make **one extra call per Xero file per night**: the most recent bank transaction marked reconciled, which gives the "reconciled to" date. This fits inside the current 25-calls-per-file nightly budget.
- The date is stored with the daily key figures we already keep per client, and read from there — the overview never calls Xero directly.
- Files that are disconnected or not registered keep showing "—".

## Security classification

SECURITY-RELEVANT: touches a client-data table, the nightly Xero refresh, and the overview feed.

- New column on `client_key_figures`: nullable `bank_reconciled_to` (date). Existing RLS, AAL2 guard and read policy already cover the table — no policy changes, no new access path.
- The extra Xero call is made by the existing overnight system job (already registered); no new `supabaseAdmin` use, no new scopes, no tokens leave the server.
- The feed item reuses the existing `overview_alert_states` acknowledge/snooze machinery — no new write path.
- After the change: `bun run security:check`, `security_posture()`, the database linter, tests for the new rule, and updates to the security backlog and access matrix as needed.

## Technical details

1. Migration: `ALTER TABLE public.client_key_figures ADD COLUMN bank_reconciled_to date;` (nullable, additive only).
2. `snapshot-keys.ts`: add a `bank_reconciled_latest` entry — `BankTransactions` with `where: IsReconciled==true`, `order: Date DESC`, first page only.
3. `key-figures.server.ts`: read that snapshot after each successful run and upsert the date.
4. `overview.server.ts` / `buildOverview`: expose `bankReconciledTo` per row.
5. `feed.server.ts`: new `bank_not_reconciled` event when the date is null or ≥14 days before the data-as-at date; severity "warning".
6. `overview.tsx`: new column, formatted like the existing "Data as at" column.
7. Tests: rule tests for the 14-day threshold and the never-reconciled case; matrix rows if the table-set checks require them.
