# Where Autotek's organisation-level tier row came from

Read-only investigation. No code or data changed.

## 1. When and by whom

`tier_widget_config` has no created-by/updated-by column. Columns are: `id, client_id, tier, widgets, created_at, updated_at, excluded_widgets, firm_id`. Attribution therefore has to come from `audit_log`.

Every organisation-level row in the table (`client_id IS NULL AND firm_id IS NOT NULL`):

| id | firm_id | tier | widgets | excluded_widgets | created_at | updated_at |
|---|---|---|---|---|---|---|
| 02623fa5-… | 78abaf83-… (Autotek NSW) | advisory | {} | {cashflow, transaction_search, true_breakeven, accounting_breakeven} | 2026-08-19 07:07:52.630976+00 | 2026-08-19 07:07:52.630976+00 |
| 33881770-… | 78abaf83-… (Autotek NSW) | multi_company | {} | {unreconciled} | 2026-08-19 07:56:35.924702+00 | 2026-08-19 07:57:06.825132+00 |
| af5492f9-… | cb63e0c4-… | multi_company | {} | {unreconciled} | 2026-08-24 08:54:58.848248+00 | 2026-08-26 01:17:21.027452+00 |

Matching `audit_log` rows (`action = 'org_widget_toggled'`):

- The Autotek **advisory** row's only audit entry is at exactly its `created_at`, with `actor_user_id = NULL` and meta `{"note": "Applied directly: the settings panel is still writing the retired widgets column.", "tier": "advisory", "widget": "transaction_search", "enabled": false}`. A null actor means it was not written by a signed-in user through the app — it was applied as a direct database statement during earlier remediation work. That single statement is also why the row carries four exclusions while only one toggle was logged.
- The two `multi_company` rows have normal audit trails: actor `57d544ad-…`, one row per click, produced by the "Cards included by default" panel.

So: Autotek's advisory row was **not** created by routine navigation. It was created by a one-off direct write on 19 August.

## 2. How many organisations have overridden each tier

```
firms | orgs_with_rows
    4 |              2

tier          | org-level rows
multi_company | 2
advisory      | 1
```

Two of four organisations have at least one organisation-level row, and each of those rows exists because someone clicked a card toggle (or, in the advisory case, a manual fix was applied). No organisation has a row for a tier nobody touched.

## 3. What creates an organisation-level row

Exactly **one** code path writes `firm_id IS NOT NULL` rows:

- `public.set_org_widget_enabled(_firm_id, _tier, _widget, _enabled)` — an `INSERT … ON CONFLICT (firm_id, tier) DO UPDATE`, seeding from the platform row's exclusions.
- Called from `src/lib/tier-config.functions.ts` → `setOrgWidget` (line 269), whose only caller is `src/components/admin/OrgDefaultCardsPanel.tsx` (`onToggle`, line 51) on the organisation settings screen.

Answers to the specific questions:

- **Opening the tier settings screen** — no. `getOrgWidgetMatrix` only reads (`src/lib/widget-resolve.server.ts` `fetchExclusions`). No write on mount.
- **Clicking Save with nothing changed** — not applicable: the panel has no Save button, only per-card pill toggles that each fire one RPC. There is no idempotent save that could write a no-op row.
- **"Set tier for all clients"** — no. `public.set_all_client_tiers` writes `client_subscriptions` and `audit_log` only; it never touches `tier_widget_config`.
- **Creating an organisation or adding a client** — no. No trigger and no insert in any migration or server function seeds a row.
- **Changing a client's tier** — no. `setClientDashboardTier` writes `client_subscriptions`. Separately, `public.set_client_widget_enabled` writes a **client-level** row (`client_id` set), never an organisation-level one.

Other writers, for completeness: `savePlatformTierWidgets` (platform row only, `src/lib/tier-config.functions.ts:89`), `saveClientTierWidgets` (client rows only, line ~140), and `deletePlanLevel` (`src/lib/plan-levels.functions.ts:154`) which deletes all rows for a removed tier.

## 4. Does Autotek's advisory row match the platform default?

No.

- Platform `advisory` (id 965b0265-…): `excluded_widgets = {}`
- Autotek `advisory`: `excluded_widgets = {cashflow, transaction_search, true_breakeven, accounting_breakeven}`

The row is a deliberate (if manually applied) edit, not an accidental duplicate. Note that `xero_audit` is **not** in it — which is why the Xero File Audit card is still visible for that client, and why changing the platform Advisory row has no effect on Autotek.

## 5. The consequence

Confirmed. `public.set_org_widget_enabled` and `public.client_allowed_widgets` both use `coalesce(org row, platform row)` — the organisation row **replaces** the platform row for that tier; it does not merge. Client-level exclusions are then unioned on top.

Practical effect: for `(organisation, tier)` pairs that have their own row, later changes to the platform row for that tier are invisible forever.

Currently in that state:
- Autotek NSW — `advisory` and `multi_company` detached
- Organisation cb63e0c4-… — `multi_company` detached

That is 2 of 4 organisations, 3 `(organisation, tier)` pairs. Every other pair still follows the platform default.

## Risk for the twenty incoming clients

Low as the code stands: a new organisation starts with no row and follows the platform default, and a row only appears when someone deliberately toggles a card on that organisation's settings screen. Navigation alone detaches nothing. The real hazard is that the detachment is **silent and permanent** — one toggle in August means a card added to the platform Advisory tier in October never reaches that organisation, with nothing on screen saying so.

## Recommended fix (not implemented)

1. **Make the state visible.** `getOrgWidgetMatrix` already returns `usesOrgRow` per tier but `OrgDefaultCardsPanel` ignores it. Show a line when it is true: "This organisation has its own card list for the Advisory dashboard and no longer follows the platform default," with a "Follow platform default again" action that deletes the organisation row for that tier.
2. **Flag drift.** On the platform tier screen (`src/routes/_authenticated/settings.tiers.tsx`), show how many organisations have detached from each tier, so a platform edit that will not reach everyone is obvious at the time it is made.
3. **Consider changing the model** (larger, needs its own decision): store organisation deltas as `{turned_off, turned_on}` relative to the platform row rather than an absolute exclusion list, so new platform cards flow through. This changes `client_allowed_widgets` and both toggle RPCs and is not a UI-only change.
4. **Tidy Autotek's advisory row** if the four exclusions are no longer wanted — either re-enable the cards through the organisation panel or delete the row so it follows the platform default again.

Nothing above has been applied.
