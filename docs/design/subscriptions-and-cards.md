# Subscriptions and dashboard cards — approved design

**Status:** approved 15 September 2026. NOT scheduled. Build when the product goes to market outside Positive Traction. **No payment system is in scope** — this is the structure only.

## Why this exists

Nine plans in `plan_levels`, three per-client tiers, and four layers of card configuration. Three independent things are encoded in one `tier` field: how much capacity, which features, and who pays. Every new combination needs a new plan name, so the names stopped meaning anything — "Multi Company Consolidation" is both a plan and a per-client tier, and "Included in bookkeeping fees" is not a plan at all, it is a billing arrangement.

## The model

An organisation's subscription is **three fields**:

| Field | Values | Notes |
| --- | --- | --- |
| **Clients** | a number | Xero file capacity follows it — one file per client |
| **Advisory** | on / off | Applies to every client in the organisation |
| **Billing** | `bookkeeping` / `external` | `bookkeeping` = absorbed in Positive Traction's fees. `external` = they pay us directly |

That is the whole thing. Nine plans collapse into three fields, and every combination is expressible without inventing a plan name.

**Consolidation is a sub-option of Advisory, not a separate purchase.** It only appears when Advisory is on AND the organisation has more than one client — with one client the consolidated cards show nothing useful. It is kept as a distinct sub-option rather than folded in silently, so it can be priced separately later. A multi-entity group is exactly the customer most likely to pay more for it.

## Cards

**Two layers, two different questions:**

1. **What is available** — decided by the organisation's purchase. Standard gives the core cards; Advisory adds the rest; Consolidation adds the multi-company views.
2. **What is switched on** — per client, a single ticked list of the available cards.

**Rules:**
- **One stored list per client: the cards that are ON.** No exclusion list, ever. The current model stores both an include and an exclude list, and they contradict each other — see below.
- A card not covered by the purchase does not appear on the client's list at all.
- **Ticking Advisory switches its cards on for every client immediately** (owner decision, 15 Sep 2026). Per-client ticks are for exceptions afterwards.
- Un-ticking Advisory switches those cards off everywhere. Decide at build time whether previous per-client exceptions are remembered if Advisory is later re-ticked, or reset — record whichever you choose.

**Starting card grouping — to be confirmed before build:**
- **Standard:** health, receivables, payables, profit & loss, notes, unreconciled, bank reconciliation
- **Advisory:** cash flow, cash flow scenario, accounting break-even, true break-even, tax liability, GST reconciliation, superannuation, PAYG withholding, Xero audit, transaction search, loan consolidation
- **Consolidation:** the consolidated multi-company views

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
| Bangkok On Darby | 1 | off | n/a | bookkeeping |
| Autotek NSW | 1 | off | n/a | bookkeeping |
| DRTABT Projects | 9 | on | on | bookkeeping |
| Positive Traction | 1 | on | n/a | bookkeeping |

No organisation is `external` yet. That is why this is the right moment to change the model — there are no paying customers to migrate.

## Explicitly out of scope

- Any payment, checkout, Stripe or invoicing work. Revisit when taking the product to market.
- Pricing itself. This records the structure being priced, not the numbers.

## When this is built

It changes what every dashboard shows, so it is a Security Gate change: entitlement caps what a viewer can see, and `client_entitlement` plus the tier helpers are part of the access path. Plan it, do not bolt it on.
