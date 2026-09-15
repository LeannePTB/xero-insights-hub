# Subscription and card model — migration plan

Classification: **security-relevant**. It touches `client_entitlement`, `client_allowed_widgets`, `client_can_use_widget`, `firm_allowed_widgets` and `firm_has_consolidation` — all on the access path. Design authority: `docs/design/subscriptions-and-cards.md` (settled).

Governing constraint accepted: **no restore test, so the migration must be safe without one.** Every step below is strictly additive, deletes nothing, and states its one-migration undo.

---

## Step 1 — Reconciliation (done, read-only, evidence below)

**Resolution order the live code actually uses** (`public.client_allowed_widgets`, mirrored in `src/lib/widget-resolve.server.ts`):

```text
1. tier       = public.client_entitlement(client)
                organisation always-free  -> highest enabled dashboard tier
                else client_subscriptions (trial/paid/free_forever), else basic
                organisation lapsed       -> basic
2. ceiling    = plan_levels.widgets for that tier (scope='dashboard', enabled)
3. exclusions = tier_widget_config row for (firm_id, tier, client_id null)
                ELSE row for (firm_id null, tier, client_id null)   <- precedence, not union
                PLUS row for (client_id, tier)
4. visible    = ceiling - exclusions
```

Not read by anything: `tier_widget_config.widgets` (retired allow-list), `clients.dashboard_widgets` (retired), `firms.default_widgets` (only a seed value in the admin screen, never in resolution). All three are stale sources that look authoritative and are not — that is the whole reason nobody could say what a client sees.

**What each client sees today** (14 clients, 2 of which are the security test org):

| Organisation | Client | Tier resolved | Cards visible today |
| --- | --- | --- | --- |
| Bangkok On Darby | Bangkok on King | basic | health, receivables, payables, pnl, notes |
| Autotek NSW | Autotek New South Wales | advisory | all 16 advisory cards (its two exclusion rows are empty) |
| DRTABT Projects | all 9 clients, identically | multi_company | receivables, payables, pnl, notes, tax_liability, gst_reconciliation, bank_reconciliation, xero_audit, loan_consolidation |
| Positive Traction | Positive Traction | multi_company (always-free) | receivables, payables, pnl, notes, tax_liability, superannuation, gst_reconciliation, bank_reconciliation, xero_audit, loan_consolidation |
| ZZ Security Test Org | ZZ Test Client One / Two | basic | health, receivables, payables, pnl, notes |

**Conflicts flagged, all resolvable — no client is indeterminate:**

1. **Positive Traction's two contradicting rows are dead.** They are keyed to `basic` and `advisory`; the client actually resolves to `multi_company` because its organisation is always-free and `multi_company` has no `tier_settings` row (absent = enabled). Neither row is consulted. This is why it looked unresolvable: the contradiction is real and has no effect.
2. **`health` in both lists** is on the platform `multi_company` row — `widgets` is retired, so only the exclusion counts: `health` is OFF for DRTABT and Positive Traction. Correct today, by accident of which column is read.
3. **Organisation row replaces the platform row.** Autotek's own `advisory` row is empty, so it silently cancels the platform exclusion of `transaction_search` — Autotek sees a card no other advisory client does.
4. **DRTABT's `firms.default_widgets` lists 15 cards** including several its clients cannot see. Ignored by resolution; a third source with no effect.
5. Nine DRTABT clients carry per-client `clients.dashboard_widgets` lists that differ from each other and from what they see. Retired column, no effect.

Consolidation working data verified now: `loan_consolidation_accounts` 56, `consolidation_group_members` 9, `consolidation_groups` 1, `loan_consolidation_snapshots` 1.

**Cascade check:** `loan_consolidation_accounts -> clients`, `consolidation_group_members -> clients`/`-> consolidation_groups`, `consolidation_groups -> firms`, `loan_consolidation_snapshots -> consolidation_groups` are all `ON DELETE CASCADE`. So no migration in this work may delete a row from `clients`, `firms` or `consolidation_groups`. Nothing planned below does.

---

## Step 2 — New shape (additive only)

New table `public.org_subscription_options` (one row per organisation): `firm_id` PK, `client_limit`, `advisory_enabled`, `consolidation_enabled`, `billing_mode` ('bookkeeping' | 'external'), timestamps. RLS on, per-command policies, `revoke all from anon, authenticated` then grant only reads to `authenticated`; all writes through aal2 definer functions.

New table `public.client_cards` (one row per client): `client_id` PK, `cards text[]` (the ON list, no exclusion list ever), timestamps, same RLS shape.

New reader `public.client_visible_cards(_client_id)` — aal2, caller-scoped, `available = standard ∪ (advisory if on) ∪ (consolidation if on and >1 client)`, `visible = available ∩ client_cards.cards`. Card groupings from the design doc, stored as a definer helper so there is one definition.

Existing tables: `plan_levels`, `subscriptions`, `client_subscriptions`, `tier_widget_config`, `firms.default_widgets`, `clients.dashboard_widgets` — **read during backfill, then left alone.** Nothing dropped, renamed or repurposed in this work.

## Step 3 — Backfill

Derived from step 1, per client, so every client sees exactly today's set:
- `client_cards.cards` = the "visible today" column above, verbatim.
- Advisory on where today's resolved tier is `advisory` or `multi_company`; Consolidation on only where `subscriptions.consolidation_enabled` is true (DRTABT only); Clients = current client count or `client_limit_override`; Billing = `bookkeeping` for all four organisations.
- Resolution rules used where the data contradicts, stated not silent: dead tier rows ignored (Positive Traction); `widgets` column ignored in favour of `excluded_widgets` (all rows); `firms.default_widgets` and `clients.dashboard_widgets` ignored (DRTABT's nine clients, Autotek).
- Positive Traction keeps `loan_consolidation` on with Consolidation off — the one legitimate mismatch, because it is a single client. Owner decision needed (below).

## Step 4 — Cutover

1. New tables written alongside every existing write path (dual write), reads unchanged.
2. `client_allowed_widgets` gains a switch row (`app_private.card_model_v2`): false = old resolution, true = `client_visible_cards`. Reads flip by updating one boolean.
3. **Switch back in one step:** set that boolean false. No data moves, the old tables are untouched and still current.

## Step 5 — Verification

- A stored snapshot of step 1's table, re-derived after cutover and compared client by client — any difference fails the batch. That comparison is the test of this work.
- The four consolidation counts asserted before and after every migration.
- New access-matrix rows: an organisation without Advisory, and one without Consolidation, refused a card from that group via dashboard read, direct URL, server function and a saved report link. Entitlement still caps a viewer.
- `bun run security:check`, `public.security_posture()`, linter — no new Action or Warn.

## Batches — riskiest first, each shippable and reversible

| # | Batch | Undo in one migration |
| --- | --- | --- |
| 1 | Snapshot table + step 1 reconciliation stored as a baseline row set (read-only, no behaviour) | drop nothing; leave the table, it is inert |
| 2 | New tables, RLS, grants, `client_visible_cards`, card-group helper — not read anywhere | leave in place, unread; or revoke execute |
| 3 | Backfill + dual write from the existing admin screens | stop writing; rows are ignored |
| 4 | Flip reads behind the switch, organisation by organisation | set the switch false |
| 5 | New matrix rows, posture check, docs, backlog | n/a — evidence only |

## Owner decisions (with my recommendation)

1. **Positive Traction's `loan_consolidation` card** — single client, so Consolidation is "n/a" in the design, yet the card is on today. Recommend: keep it on as a named grandfathered exception recorded in the design doc, rather than silently removing a card you use.
2. **Autotek's `transaction_search`** — visible today only because an empty organisation row cancels the platform exclusion. Recommend: keep it (preserve today's view exactly), and let a per-client tick remove it later if unwanted.
3. **The ZZ Security Test Org clients** — recommend backfilling them like any other so the matrix keeps working.
4. **Retiring the old tables** — recommend no earlier than one month after batch 4, as its own decision.

## Credit estimate

Roughly 30–45 credits: batch 1 ~4, batch 2 ~8, batch 3 ~10, batch 4 ~10, batch 5 ~6, plus verification reruns. Step 1 is already done and costs nothing further.
