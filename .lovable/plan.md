# Plan: Nest the Loan Consolidation card inside the Company Consolidations hub

## Goal
On the organisation dashboard, make the **Company Consolidations** card the single top-level consolidation hub. Move the **Loan Consolidation** card inside that hub as a nested option, leaving room for more consolidation cards in the future.

## Current state
- `src/components/admin/CompanyConsolidationsCard.tsx` is a standalone card showing the consolidation groups summary and linking to the loan workspace.
- `src/components/admin/LoanConsolidationCard.tsx` is a standalone card with the same link and is rendered as a sibling on the dashboard.
- `src/routes/_authenticated/firms.$firmId.index.tsx` renders both cards in a 2-column grid above the clients list.

## Proposed changes

1. Convert `CompanyConsolidationsCard` into a hub container
   - Keep the title **Company Consolidations** and the groups summary.
   - Change its **Open** button to link to `/firms/$firmId/loans/groups` (the Groups tab), so the hub opens the groups management page.
   - Add a nested **Consolidation tools** section below the groups summary.
   - Render `<LoanConsolidationCard firmId={firmId} />` inside that section as a full-width nested card.

2. Keep `LoanConsolidationCard` as the nested card
   - Retain its title, description, **Open** button, and "Go to loan consolidation" link.
   - Its link stays `/firms/$firmId/loans` (the Matrix/loan workspace).
   - Tone down its background/border when rendered inside the hub so it doesn't visually fight with the outer card (e.g. use `bg-background` with a subtle border).

3. Simplify the organisation dashboard
   - Remove the 2-column grid from `src/routes/_authenticated/firms.$firmId.index.tsx`.
   - Render only the `CompanyConsolidationsCard` hub above the clients list.

4. Typecheck after the refactor.

## Outcome
The dashboard will show one **Company Consolidations** hub card. Inside that hub, the groups summary sits at the top and the **Loan Consolidation** card is nested below it, ready for additional consolidation cards to be added later.

## Technical notes
- No database changes.
- No route changes.
- Only component layout and link target changes.
