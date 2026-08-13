# Make widget toggles actually apply on the client dashboard

Your saved widget settings are being ignored because the dashboard has a hard rule: when the signed-in user is an advisor (which you are), it shows **every** widget and skips the saved configuration entirely. That is why turning cards off in "Standard · custom for this client" changes nothing on screen.

## What changes

- The client dashboard respects the saved widget list for everyone, advisors included: client-specific override first, then the global default for that tier, then the built-in default.
- Add a small **"Show all widgets"** switch in the client dashboard header, visible only to advisors and super-admins. Off by default, so what you see matches what the client sees. Turn it on when you need to reach a card that is currently switched off. The choice is remembered for the session.
- The tier used to resolve the list is the client's own tier (from their access record), not "the highest tier that happens to be enabled". Advisors on a client with no viewer yet fall back to the highest tier included in the organisation's plan, so nothing disappears entirely.
- Saving in the widget settings panel refreshes the dashboard immediately (the cached widget list is invalidated), so you no longer need a hard reload to see the effect.
- "View as" preview keeps working exactly as it does now.

## Technical notes

- `src/routes/_authenticated/clients.$clientId.index.tsx`: remove the `isAdvisor ? ALL_WIDGETS : ...` short-circuit and the `enabled: !isAdvisor` guard on the `effective-widgets` query; gate the full list behind the new advisor-only "Show all widgets" state (`sessionStorage`-backed).
- Resolve `tier` from `viewerEntry?.tier` first; for advisors with no viewer entry, use the highest plan-allowed enabled tier as today.
- `src/routes/_authenticated/clients.$clientId.settings.tsx`: after `saveTierWidgets` succeeds, invalidate the `["effective-widgets", clientId]` queries.
- No database or server-function changes required — `getEffectiveWidgets` already resolves override → global → default correctly.
