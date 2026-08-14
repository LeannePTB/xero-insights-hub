# Make the default-card ticks visible

## Why nothing looks tickable

In "What's included", the default cards are drawn as coloured pills. For multi-company organisations those pills *are* clickable toggles (an off card turns grey with a strikethrough), but there is no checkbox or any other hint, so when everything is on it just looks like a plain read-only list. For other organisations the same section really is read-only.

## What changes

In the "Cards included by default" block on an organisation's page, for multi-company organisations only:

- Show a real checkbox next to each card name, laid out as a two-column list (same style as the "What this client sees" panel in client settings), instead of pills.
- Cards allowed by the plan but currently switched off appear unticked, not hidden.
- Add "Select all" / "Clear all" links above the list.
- Keep the existing Save / Cancel buttons that appear once something changes, and keep the explanatory line underneath.

Organisations that aren't multi-company keep the current read-only pill list and its wording — nothing changes there.

## Technical notes

- Single file: `src/routes/_authenticated/firms.$firmId.index.tsx`, the `isMulti` branch of the "Cards included by default" section (around lines 263-305).
- Replace the pill buttons with `Checkbox` from `@/components/ui/checkbox` inside `<label>` rows; reuse the existing `draftWidgets` / `selectedWidgets` state and `saveDefaults` handler unchanged.
- Iterate `summary.availableWidgets ?? summary.widgets` as today so plan-limited cards stay out of the list.
- No server, schema, or business-logic changes.
