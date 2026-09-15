# Subscriptions and dashboard cards — approved design

**Status:** approved 15 September 2026. NOT scheduled. Build when the product goes to market outside Positive Traction. **No payment system is in scope** — this is the structure only.

## Why this exists

Nine plans in `plan_levels`, three per-client tiers, and four layers of card configuration. Three independent things are encoded in one `tier` field: how much capacity, which features, and who pays. Every new combination needs a new plan name, so the names stopped meaning anything — "Multi Company Consolidation" is both a plan and a per-client tier, and "Included in bookkeeping fees" is not a plan at all, it is a billing arrangement.

## The model

An organisation's subscription is **four fields**:

| Field | Values | Notes |
| --- | --- | --- |
| **Clients** | a number | Xero file capacity follows it — one file per client |
| **Advisory** | on / off | Applies to every client in the organisation |
| **Consolidation** | on / off | Separately chargeable. Requires Advisory |
| **Billing** | `bookkeeping` / `external` | `bookkeeping` = absorbed in Positive Traction's fees. `external` = they pay us directly |

That is the whole thing. Nine plans collapse into three fields, and every combination is expressible without inventing a plan name.

**Consolidation is a separately chargeable option.** It is not included in Advisory and does not switch itself on. The rules:
- It can only be purchased when **Advisory is on** — it extends Advisory rather than standing alone.
- It is only meaningful with **more than one client**. With a single client the consolidated cards have nothing to consolidate, so the option is shown but unavailable, with a short explanation rather than a silent absence.
- Turning **Advisory off also turns Consolidation off**, since it depends on it. Warn before doing so rather than removing it silently.
- The consolidated cards become available to every client in the organisation once it is on, following the same rule as Advisory.

This is a deliberate commercial decision. A multi-entity group is the customer most likely to pay more, and consolidation is the most valuable thing the product offers them — folding it into Advisory would give it away.

## Cards

**Two layers, two different questions:**

1. **What is available** — decided by the organisation's purchase. Standard gives the core cards; Advisory adds the rest; Consolidation adds the multi-company views.
2. **What is switched on** — per client, a single ticked list of the available cards.

**Rules:**
- **One stored list per client: the cards that are ON.** No exclusion list, ever. The current model stores both an include and an exclude list, and they contradict each other — see below.
- A card not covered by the purchase does not appear on the client's list at all.
- **Ticking Advisory switches its cards on for every client immediately** (owner decision, 15 Sep 2026). Per-client ticks are for exceptions afterwards.
> **Per-client exceptions survive Advisory being switched off and on again** (owner decision, 15 September 2026). Turning Advisory off hides its cards everywhere but does not erase which ones were individually switched off; turning it back on restores each client to exactly the state it was in, not to "everything on".
>
> Implications for the build:
> - The per-client card list must persist while the feature is off. Do not delete rows on downgrade — mark the cards unavailable and keep the stored preferences.
> - **Clients added while Advisory was off have no remembered state.** They take the default — all Advisory cards on — when it is switched back on. Make that visible in the confirmation rather than leaving it to be discovered.
> - The confirmation when switching Advisory back on should say what will happen: which clients return to a previous arrangement, and which are new and will get everything.
> - The same rule applies to Consolidation.

**Card grouping — confirmed 15 September 2026**
- **Standard:** health, receivables, payables, profit & loss, notes, unreconciled, bank reconciliation
- **Advisory:** cash flow, cash flow scenario, accounting break-even, true break-even, tax liability, GST reconciliation, superannuation, PAYG withholding, Xero audit, transaction search, loan consolidation
- **Consolidation:** the consolidated multi-company views

The Standard set is confirmed by the owner as the right free/included baseline. It is what a business owner needs to answer "am I alright?" without paying more.

The Standard/Advisory line is a pricing decision, not a technical one: too much in Standard and nobody upgrades; too little and Standard looks thin.

## Current data is contradictory — clean up as part of this work

Verified 15 September 2026:
- `tier_widget_config` carries both `widgets` and `excluded_widgets`. At least one row lists `health` in **both**.
- The client "Positive Traction" has two rows, `basic` and `advisory`, with different and conflicting card sets.
- Rows exist with `client_id` null (tier defaults) alongside per-client rows, and `firms.default_widgets` is a third source — with `DRTABT Projects` the only organisation that sets it.

Nobody can currently say with confidence which cards a given client will see. The rebuild must collapse this to one list per client and discard the exclusion mechanism entirely.

## How today's organisations map

| Organisation | Clients | Advisory | Consolidation | Billing |
| --- | --- | --- | --- | --- |
| Bangkok On Darby | 1 | off | n/a — single client | bookkeeping |
| Autotek NSW | 1 | off | n/a — single client | bookkeeping |
| DRTABT Projects | 9 | on | on | bookkeeping |
| Positive Traction | 1 | on | n/a — single client | bookkeeping |

No organisation is `external` yet. That is why this is the right moment to change the model — there are no paying customers to migrate.

## Explicitly out of scope

- Any payment, checkout, Stripe or invoicing work. Revisit when taking the product to market.
- Pricing itself. This records the structure being priced, not the numbers.

## When this is built

It changes what every dashboard shows, so it is a Security Gate change: entitlement caps what a viewer can see, and `client_entitlement` plus the tier helpers are part of the access path. Plan it, do not bolt it on. The three purchasable options are Clients, Advisory and Consolidation, and each must be independently provable in the access matrix — an organisation without Consolidation must not reach a consolidated card by any route, including a direct URL or a saved report link.
