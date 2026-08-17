# Remove Business Health from DRTABT on the live site

## Confirmed state

- The screenshot is from the live custom domain, `tractionadvisory.com.au`.
- In the database, DRTABT Projects has Business Health removed from its organisation defaults.
- The affected client, **A.C.N. 657 659 026 Pty. Ltd**, also has Business Health removed from its saved client card list.
- The current project code only renders Business Health when the resolved card list includes `health`, and it now forces that list to refresh.

The remaining gap is deployment: the live custom domain has not yet received the current visibility and cache fixes.

## Plan

1. Publish the current project version so the fixed card-resolution logic reaches `tractionadvisory.com.au`.
2. Open the live DRTABT client dashboard for **A.C.N. 657 659 026 Pty. Ltd** in a fresh browser session.
3. Verify that the live `getClientWidgets` response excludes `health` and that no Business Health card is rendered.
4. Check another DRTABT client to confirm the organisation-wide setting applies consistently.
5. If the live response still contains `health`, trace that production server-function response and fix the resolution path rather than adding another browser cache workaround.

## Expected result

Business Health is absent from every DRTABT Projects client dashboard on the live custom domain, while other organisations retain their own independent settings.