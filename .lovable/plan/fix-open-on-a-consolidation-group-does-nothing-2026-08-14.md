# Fix: "Open" on a consolidation group does nothing

## What's happening

The consolidated view page exists and the group is set up correctly. The problem is routing.

The organisation page (`/firms/{id}`) is also the parent of the consolidated page
(`/firms/{id}/consolidated/{groupId}`). Right now that parent renders the organisation
page body and never gives its child page a place to appear. So clicking **Open** does
change the URL, but the screen keeps showing the organisation page — it looks like the
button is dead.

```text
/firms/$firmId              -> renders organisation page (no slot for children)
/firms/$firmId/consolidated/$groupId -> never gets rendered
```

## The fix

Split the organisation route into a layout plus a leaf page:

1. `src/routes/_authenticated/firms.$firmId.tsx` becomes a thin layout that only renders
   `<Outlet />`, keeping its existing `validateSearch`.
2. The entire current organisation page body (header, plan card, clients section,
   consolidation groups section, dialogs) moves unchanged into a new
   `src/routes/_authenticated/firms.$firmId.index.tsx` leaf with its own `head()` metadata,
   so `/firms/{id}` looks and behaves exactly as it does today.
3. No change to `ConsolidationGroupsSection` or to the consolidated page itself — the
   existing `Open` link starts working once the child route can render.

## Verification

- `/firms/{id}` still shows organisation details, clients and consolidation groups.
- Clicking **Open** on a group loads the consolidated view (receivables, payables,
  intercompany loan consolidation), and **Back to organisation** returns correctly.
- Edit and delete on a group still work.

## Note

You mentioned it behaves differently from the Hub project. This plan restores the group
page so it opens at all. If the consolidated page itself is missing widgets you had in
Hub (e.g. consolidated P&L / balance sheet), tell me which ones and I'll add them as a
follow-up.
