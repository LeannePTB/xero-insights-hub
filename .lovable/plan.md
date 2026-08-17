# Show Settings while previewing as the organisation owner

## What's happening

On the organisation dashboard, the Settings button (and the "All organisations" back link) is hidden whenever you're in "Preview: … as the organisation owner" mode. Since the owner is exactly the person who *does* have Settings, the preview shows less than the real owner would see — which is why Settings looks missing on that page.

## The change

- Keep the Settings button visible while previewing, so the preview matches what an owner actually sees (plan, add clients, support access, subscription).
- Keep the "All organisations" back link hidden in preview, since owners don't have that.

## Technical detail

In `src/routes/_authenticated/firms.$firmId.index.tsx`, remove the `!previewing` condition around the Settings link block only. The Settings route itself already renders for firm owners/advisors, so no other changes are needed.
