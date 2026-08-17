Update the default-cards helper text to match the pill toggle UI

The "Cards included by default" section in the organisation dashboard uses clickable pill buttons to toggle cards on/off, not checkboxes. The current helper text says "Untick a card" and "ticked cards", which is confusing because there is no tick box.

Change
1. Update the helper text in `src/routes/_authenticated/firms.$firmId.index.tsx` below the default cards pill list.
2. Wording: "Click a card to turn it off for every client in this organisation — changes save straight away. New clients start with the selected cards, and each client's own settings can still turn cards off individually."
3. Keep the existing pill toggle behaviour unchanged (clicking a pill toggles its selection and saves immediately).

Technical details
- File: `src/routes/_authenticated/firms.$firmId.index.tsx` around line 318-322.
- The pill buttons are already implemented and call `toggleWidget`; no interaction changes.
- No backend or data changes required.
