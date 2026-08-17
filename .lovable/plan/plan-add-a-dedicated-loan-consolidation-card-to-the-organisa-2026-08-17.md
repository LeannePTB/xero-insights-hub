# Plan: Add a dedicated Loan Consolidation card to the organisation dashboard

## Goal
On the organisation dashboard, keep the new **Company Consolidations** card as the top-level consolidation hub while re-adding a separate **Loan Consolidation** card that links directly to the loan consolidation workspace. The layout should make it easy to add more consolidation-type cards in the future.

## Current state
- `src/components/admin/LoanConsolidationCard.tsx` was just renamed to show **Company Consolidations** and links to `/firms/$firmId/loans`.
- `src/routes/_authenticated/firms.$firmId.index.tsx` renders only that one card above the clients list.
- The original loan consolidation page lives at `/firms/$firmId/loans`.

## Proposed changes

1. Rename/refactor the current component
   - Rename `LoanConsolidationCard` to `CompanyConsolidationsCard` (file and component).
   - Keep its current content: title, summary, Open button linking to `/firms/$firmId/loans`.

2. Create a new `LoanConsolidationCard` component
   - Title: **Loan Consolidation** with a relevant icon.
   - Short description explaining it links to inter-company loan reconciliation.
   - Primary button linking to `/firms/$firmId/loans`.

3. Update the organisation dashboard
   - Import both `CompanyConsolidationsCard` and `LoanConsolidationCard`.
   - Render them as two cards in a 2-column grid on desktop, stacked on mobile.
   - Keep the section above the clients list.

4. Typecheck after the refactor.

## Outcome
The organisation dashboard will show a clear “Consolidations” area with two cards: **Company Consolidations** and **Loan Consolidation**, ready for additional cards to be added later.

## Technical notes
- No database changes.
- No route changes.
- Only React component moves and dashboard layout changes.
