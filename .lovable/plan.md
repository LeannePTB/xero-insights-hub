# Simplify the organisation page: one "Loan Consolidation" button

## What changes

On the organisation page, the full "Consolidation groups" card (with each group listed and its Open / Loan consolidation / Edit / Delete buttons) is replaced by a single **Loan Consolidation** button.

Clicking it opens the existing Company Loan Consolidation area, which already has tabs for:
- Matrix (reconciliation)
- Groups (create, edit, delete groups, open a consolidated dashboard)
- Loan accounts (pairings)

So nothing is lost — group management and all the other settings simply live inside that one area.

## Technical detail

- `src/routes/_authenticated/firms.$firmId.index.tsx`: remove the `<ConsolidationGroupsSection firmId={firmId} />` block and its import; render a compact card/button linking to `/firms/$firmId/loans`.
- `src/routes/_authenticated/firms.$firmId.loans.groups.tsx` keeps rendering `ConsolidationGroupsSection`, so the Groups tab is unchanged.
- No database or server-function changes.
