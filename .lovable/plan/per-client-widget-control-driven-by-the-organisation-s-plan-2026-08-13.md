# Per-client widget control, driven by the organisation's plan

The current setup has two competing ideas fighting each other: the organisation plan says which *tiers* it may use, and widgets are then configured *per tier*, while the dashboard picks a tier from the viewer's access record. That's why Positive Traction (Multi company plan) edits the Multi company row and the dashboard — which resolves the client to Standard — ignores it.

## The model going forward

1. **Plan sets the ceiling.** The organisation's plan lists the dashboard tiers it's allowed to use (unchanged). The widgets available to that organisation are everything included in those tiers.
2. **Each client gets its own widget list.** Inside a client's settings there is one simple panel: "What this client sees" — a checkbox per widget. Anything outside the organisation's plan is shown greyed out with "Not in your plan".
3. **The dashboard shows exactly that list** — for the advisor and for the client viewer, identically. No tier guessing.

## What changes on screen

**Client settings**
- Replace the "Dashboard widgets per tier" matrix with a single "What this client sees" panel: one checkbox per widget, plus a "Reset to plan default" link.
- A small line at the top: "Positive Traction is on the Multi company plan — all widgets available."
- Widgets outside the plan are disabled with a short note, not hidden.

**Client dashboard**
- Renders exactly the saved list for that client. Turning a card off in settings removes it immediately (settings save refreshes the dashboard cache).
- If a client has never been configured, it falls back to the default widget set for the highest tier its organisation's plan includes.

**Tier defaults (super admin)**
- The global "Dashboard widgets per tier" page stays as-is: it defines the *starting point* a new client inherits. It is no longer the thing that overrides individual clients.

**Viewer tiers**
- The tier on a viewer's access record no longer decides what's on the dashboard; it stays only as a label for who they are. Nothing to change for existing viewers.

## Technical notes

- Migration: add `public.clients.dashboard_widgets text[] null` (null = not configured, use plan default). No new table needed; the existing `tier_widget_config` keeps serving global tier defaults.
- New server fns in `src/lib/tier-config.functions.ts`:
  - `getClientWidgets({ clientId })` → resolves `clients.dashboard_widgets` → default widgets for the highest plan-allowed tier → `DEFAULT_TIER_WIDGETS.basic`. Also returns `availableWidgets` (union of the tier defaults for every tier in the plan) so the UI can grey out the rest.
  - `saveClientWidgets({ clientId, widgets | null })` — advisor/firm/super-admin only, filters the list down to `availableWidgets` server-side.
- `clients.$clientId.index.tsx`: swap `getEffectiveWidgets` + tier resolution for `getClientWidgets`; keep the `viewAs` preview by passing a tier override.
- `clients.$clientId.settings.tsx`: replace the per-tier editor block with the single widget panel; on save invalidate `["client-widgets", clientId]`.
- Keep `getEffectiveWidgets` for now so `UpgradeOptions` and the tiers admin page keep working.
