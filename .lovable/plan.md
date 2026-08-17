# Why Business Health is still showing — and the fix

## What I found

Checked the live data for both organisations:

- **DRTABT Projects** — Business Health *is* turned off. The organisation's default card list and every one of its 12 clients no longer include it.
- **Positive Traction** — Business Health is still **on**. The organisation has no saved default card list at all (never written), and the Positive Traction client still has `health` in its own card list.

So the untick on Positive Traction never reached the database. The reason is in the UI: unticking a card in "Cards included by default" only changes a *draft*. A **Save** button appears underneath the pills once something changes, and nothing is written until it is clicked. On a narrow window (your screenshot is cut off right below the pills) that button is easy to miss — the card looks unticked, you navigate away, and the change is silently discarded.

## The fix

1. **Make the toggles save themselves.** Clicking a card in "Cards included by default" writes immediately, shows a brief "Saved" toast, and refreshes the client list and dashboards. No separate Save step, nothing to lose by navigating away.
2. **Show it's saving.** The pill is disabled while the write is in flight; if the save fails, the pill snaps back to its previous state with an error toast, so the screen never lies about what is stored.
3. **Turn off Business Health for Positive Traction** as part of this, so the state matches what you already intended.

## Technical notes

- `src/routes/_authenticated/firms.$firmId.index.tsx`: replace the `draftWidgets` + `dirty` + Save-button flow with a mutation fired per toggle (optimistic local state, rollback on error), invalidating `["firm-plan-summary", firmId]`, `["clients", firmId]` and `["client-widgets"]`.
- No server change needed: `saveFirmDefaultWidgets` already writes `firms.default_widgets` and intersects every client's `dashboard_widgets`, and `getClientWidgets` already treats the firm list as a hard ceiling.
- Data step: remove `health` from Positive Traction's default card list and from its client's saved list.
