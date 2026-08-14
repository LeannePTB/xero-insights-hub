# Mark super-admin-only areas

Make it obvious at a glance which controls and panels only platform super admins can see, using one consistent visual treatment.

## The marker

A small reusable badge: an amber/violet pill reading "Super Admin View" with a shield icon, styled from existing semantic tokens (not hardcoded colours). Two forms:

- **Section badge** — sits next to a card or page heading.
- **Inline chip** — a compact "Super admin" tag next to a single button or row control.

Optionally, super-admin-only cards get a subtle tinted border/background so the whole block reads as restricted.

## Where it appears

- Organisation page: the **Edit plan** button and the **Audit log** card.
- Admin → Security console (posture card and super-admin-only actions).
- Admin → Plans page (whole page).
- Settings → Dashboard tiers: create/delete/edit tier controls.
- Settings → Advisors: the make/remove super-admin controls.
- Admin home and Dashboard: super-admin-only sections (all organisations view, add organisation).
- Client settings: any panel gated on super admin.

While an admin is previewing "as" someone else, these markers stay hidden along with the controls themselves.

## Technical notes

- New component `src/components/admin/SuperAdminOnly.tsx` exporting `SuperAdminBadge` (pill) and optionally a `SuperAdminSection` wrapper that renders the tinted container plus badge.
- Colour comes from a new semantic token pair in `src/styles.css` (e.g. `--admin-accent` / `--admin-accent-foreground`) so it works in light and dark themes.
- Purely presentational — no changes to gating logic, server functions, or RLS. Existing `isSuperAdmin` / `isSuper` flags decide where the badge renders.
