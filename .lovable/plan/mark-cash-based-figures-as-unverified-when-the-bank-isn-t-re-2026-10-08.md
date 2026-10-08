# Mark cash-based figures as unverified when the bank isn't reconciled

## Problem

Bangkok on King shows "Protected money 133%" and a critical badge, but the bank feed and reconciliation haven't been done — so the cash figure (and everything derived from it) is stale and misleading. The new "Bank reconciled to" column shows the date, but nothing connects it to the figures it undermines.

## What you'll see

For any client whose bank hasn't been reconciled in the last 14 days (or never):

1. **Status column** — an amber "Bank not reconciled" chip appears next to the health badge, so the row explains itself at a glance.
2. **Cash at bank, 7-day change and Protected money cells** — the numbers stay visible but show a small amber warning marker. Hovering (or tapping) explains: "Bank not reconciled since {date} — these figures may not reflect the real position."
3. Clients reconciled within 14 days look exactly as they do today.

The "What changed" feed already flags these clients; this change makes the table itself honest about it.

## Technical details

- Reuse the existing 14-day rule (`BANK_NOT_RECONCILED` in `src/lib/overview/thresholds.ts`) and the `bankReconciledTo` date already on each overview row — no new data, no new Xero calls, no database changes.
- The staleness check (`bankReconciledStale`) currently lives in a server-only module; move the pure function to a shared module so the table can use the same rule rather than a copy.
- Changes are confined to `src/routes/_authenticated/overview.tsx` plus moving that one helper. The health badge logic itself is untouched.

## Security classification

Not security-relevant: read-only presentation of data the viewer is already authorised to see. No access rules, policies, functions or Xero calls change. Standard checks (`bun run security:check`) will still be run before finishing.
