# Subscription and card model — migration plan (amended: fidelity requirement dropped)

Classification: **security-relevant**. It touches `client_entitlement`, `client_allowed_widgets`, `client_can_use_widget`, `firm_allowed_widgets` and `firm_has_consolidation` — all on the access path. Design authority: `docs/design/subscriptions-and-cards.md` (settled). Owner amendment, 15 September 2026: dashboards may change; she will adjust them afterwards.

Governing constraint: **no restore test, so safety comes from never deleting anything.** Strictly additive; every batch states its one-migration undo.

**Why the drop is safe — verified 15 September:** `client_access` has **0 rows**; `firm_viewer_access` has **1 row**, which is the security-test viewer on the ZZ Security Test Org, not a business owner; there are no pending invites. The only people who see these dashboards today are Positive Traction staff, and the staff screens keep working off the same resolution either way.

---

## Step 1 — Snapshot for reference only (short)

- Save the current stored configuration — `tier_widget_config` rows, `firms.default_widgets`, `clients.dashboard_widgets`, `plan_levels.widgets` — to one file (`docs/design/card-model-pre-migration-snapshot.md`) as a manual reference. No derivation of "what each client sees today".
- One short note naming which configuration conflicts existed (already known, confirmed live this morning: `health` in both lists on the platform `multi_company` row; Positive Traction's dead `basic`/`advisory` rows; Autotek's empty org row silently cancelling the platform `transaction_search` exclusion; DRTABT's nine stale per-client lists and `firms.default_widgets` row). No resolution of each.
- Record the four consolidation counts (56 / 9 / 1 / 1) as the baseline for every later assertion.

## Step 2 — New shape (additive only)

- `public.org_subscription_options` (one row per organisation): `firm_id` PK, `client_limit`, `advisory_enabled`, `consolidation_enabled`, `billing_mode` ('bookkeeping' | 'external'), timestamps. RLS on; `revoke all from anon, authenticated`, then grant only what per-command policies need; writes only through aal2 definer functions.
- `public.client_cards` (one row per client): `client_id` PK, `cards text[]` — the single ON list. No exclusion mechanism, ever.
- New reader `public.client_visible_cards(_client_id)`: aal2, caller-scoped; `available = standard ∪ (advisory if on) ∪ (consolidation if on and organisation has >1 client)`; `visible = available ∩ client_cards.cards`. Card groupings per the design doc, in one definer helper.
- **Turning Advisory or Consolidation off updates `org_subscription_options` only** — `client_cards` rows are never deleted, so per-client ticks survive off-and-on, as the design requires.
- Existing tables (`plan_levels`, `subscriptions`, `client_subscriptions`, `tier_widget_config`, `firms.default_widgets`, `clients.dashboard_widgets`): read during backfill, then left alone. Nothing dropped, renamed or repurposed.

## Step 3 — Backfill (simple)

- Every client gets **all cards its organisation's purchase allows, switched on**. No attempt to preserve current exclusions.
- Organisation mapping from the design doc: DRTABT Projects (9 clients, Advisory on, Consolidation on, bookkeeping); Positive Traction (1, Advisory on, Consolidation off — single client, bookkeeping); Bangkok On Darby and Autotek NSW (1 each, Advisory off, bookkeeping). ZZ Security Test Org backfilled like any other so the access matrix keeps working.
- `loan_consolidation` is a Consolidation card, so it lands only on DRTABT's nine lists. **Owner decision, accepted:** Positive Traction loses it, no grandfathered exception.
- **New clients created after cutover** (addition 1): the client-creation function writes the `client_cards` row **in the same transaction**, defaulting to every card the organisation's purchase allows. Belt and braces: `client_visible_cards` treats a **missing row as "all available"**, never as "none" — a failure there shows too much to a staff member rather than a blank dashboard, and never more than the purchase allows.
- Stop condition: any step that seems to need deleting data halts and reports instead.

## Step 3a — Which system governs cards (addition 2)

After cutover, **the organisation's purchase governs which cards exist, and entitlement stops being a card gate entirely.** I agree with you, and the reason is precisely the drift we are migrating away from: today `client_entitlement` picks a tier, `plan_levels.widgets` turns that into a ceiling, and `tier_widget_config` subtracts from it — three places, three sources, contradictions nobody could resolve. Two gates cannot be kept honest.

What that means concretely:
- `client_allowed_widgets` / `client_can_use_widget` / `firm_allowed_widgets` resolve **only** from `org_subscription_options` + `client_cards`. No tier appears in card resolution.
- `client_entitlement` and `client_subscriptions.dashboard_tier` are **not deleted and not repurposed** — they keep doing plan/limit and billing-state work (lapsed organisation, trial expiry, plan limits) and stop deciding cards.
- The viewer cap is unchanged and stays where it is: a viewer still sees no more than the client shows, because it goes through the same caller-scoped read check. What changes is that a viewer's *tier* no longer subtracts cards — the organisation's purchase and the client's ticks do.
- One consequence to accept knowingly: a lapsed organisation currently collapses to Standard cards through entitlement. Under the new model that must be expressed as the purchase itself (Advisory off), so Batch 4 includes a lapsed check in `client_available_cards` rather than relying on the tier.

## Step 4 — Cutover

1. Dual-write: the admin card screens write `client_cards` alongside the old tables; reads unchanged.
2. Reads flip on `app_private.platform_settings` key `card_model_v2` (addition 3) — a settings row read by `client_allowed_widgets`, so it flips **instantly, with no migration**, through an aal2 super-admin audited function.
3. **Reverse in seconds:** set that row false. Old tables are untouched and still current.

## Step 5 — Verification

- Every client has exactly one card list, no contradictions, no exclusion mechanism consulted anywhere in resolution.
- No client shows a card its organisation's purchase does not allow.
- Entitlement still caps what any viewer sees (existing matrix rows all pass).
- New matrix rows: an organisation without Advisory, and one without Consolidation, refused a card from that group via dashboard read, direct URL, server function and a saved report link; **and a newly created client has a usable dashboard**.
- The four consolidation counts asserted unchanged before and after every migration.
- `bun run security:check`, `public.security_posture()`, linter — no new Action or Warn.


**Cascade check (done):** `loan_consolidation_accounts -> clients`, `consolidation_group_members -> clients`/`-> consolidation_groups`, `consolidation_groups -> firms`, `loan_consolidation_snapshots -> consolidation_groups` are all `ON DELETE CASCADE`. No migration in this work deletes a row from `clients`, `firms` or `consolidation_groups`.

## Batches — riskiest first, each shippable and reversible

| # | Batch | Undo in one migration |
| --- | --- | --- |
| 1 | Snapshot file + consolidation-count baseline (read-only) | nothing to undo |
| 2 | New tables, RLS, grants, `client_visible_cards`, grouping helper — unread | leave in place, or revoke execute |
| 3 | Backfill + dual write from admin screens | stop writing; rows ignored |
| 4 | Flip reads behind the switch | set switch false |
| 5 | New matrix rows, posture check, docs, backlog | evidence only |

## Owner decisions (with my recommendation)

1. **Positive Traction's `loan_consolidation` card** — Consolidation is n/a for a single client, so under the new model that card would come off your own dashboard. Recommend: accept that (you see the consolidated views through DRTABT anyway), rather than building a grandfathered exception. Say the word if you'd rather keep it.
2. **Autotek's `transaction_search`** — disappears when Advisory comes on for them later unless ticked. No decision needed today.
3. **Retiring the old tables** — no earlier than one month after batch 4, as its own decision, and never by deletion inside this work.

## What you'll need to do after cutover

One pass per client unticking what's not needed: 14 clients, 9 of them DRTABT entities that will almost certainly be identical — realistically under an hour including checking. A "copy this client's card setup to the other entities in the organisation" action would cut that to minutes and I recommend building it as a small follow-up; I won't build it unasked.

## Credit estimate

Roughly 25–35 credits now the fidelity work is gone: batch 1 ~2, batch 2 ~8, batch 3 ~6, batch 4 ~8, batch 5 ~5, plus verification reruns.
