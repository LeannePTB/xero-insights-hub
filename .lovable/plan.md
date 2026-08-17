# Business Health still showing on DRTABT dashboards

## What the data says

The two organisations are entirely separate, and DRTABT Projects looks correct in the database:

- DRTABT's organisation default card list does **not** include Business Health.
- All 12 DRTABT clients have Business Health removed from their own saved card list.

Every place the card can render on a client dashboard is gated on that saved list, so on the current code and current data the card should not appear. That means the diagnosis is **not yet confirmed** — something at runtime is returning or holding onto a stale list. Step 1 is to prove which.

## Plan

**1. Reproduce it signed in, on a DRTABT client**

Open a DRTABT client dashboard in the preview and read what the card-list call actually returns for that client, plus what the page renders. Three possible outcomes:

- The call returns Business Health → the resolution logic is wrong for this organisation; fix it there.
- The call omits it but the card is still on screen → the page is serving a cached/stale list; fix the caching.
- The card is not there at all → we are looking at different screens, and I'll ask exactly which page and client shows it.

**2. Kill the staleness (do this regardless)**

The card list is cached per browser session and only refreshed when something explicitly invalidates it. Turning a card off in one place can leave another tab or a previously-visited dashboard showing the old list until a hard reload. Make the client dashboard always refetch its card list on mount, and have every save (organisation defaults and per-client settings) clear the cached lists for all clients in that organisation.

**3. Make the organisation toggles save on click**

Separate but related: in "Cards included by default", clicking a card only changes a draft — a Save button appears below the pills and nothing is written until it is clicked. That is easy to miss on a narrow window. Make each click save immediately, with a short "Saved" toast and rollback on failure.

## Technical notes

- Verification: Playwright against `localhost:8080` on a DRTABT client route, logging the `getClientWidgets` response and whether `HealthWidget` is in the DOM.
- `src/routes/_authenticated/clients.$clientId.index.tsx`: `["client-widgets", clientId, ...]` query gets `staleTime: 0` + `refetchOnMount: "always"`.
- `saveClientWidgets` / `saveFirmDefaultWidgets` callers: invalidate the `["client-widgets"]` key prefix (all clients), not just the current one, plus `["firm-plan-summary", firmId]` and `["clients", firmId]`.
- `src/routes/_authenticated/firms.$firmId.index.tsx`: replace `draftWidgets` + `dirty` + Save button with a per-toggle mutation (optimistic, rollback on error).
- No schema change. No change to `getClientWidgets` resolution unless step 1 shows it returning `health`.
