# Remove the duplicate dashboard-tier editor

Keep `/settings/tiers` ("Tier widgets") as the single place to manage client dashboard tiers, and take the duplicate tier editor out of `/admin/plans`.

## What changes

**Admin → Subscription levels (`/admin/plans`)**
- Remove the "Client dashboard tiers" section (its add / edit / duplicate / delete controls).
- Keep the "Organisation plans" section exactly as is, including its "Included dashboard tiers" picker — that still reads tier names from the catalogue, so plans keep working.
- Add a short line under that picker linking to the tiers page ("Manage tiers") so there's an obvious path to the one editor.
- Update the page heading/description so it only talks about organisation plans.

**Admin → Tier widgets (`/settings/tiers`)**
This page must now cover everything the removed section did, so it gains the fields it's currently missing:
- Rename a tier (currently name is only settable when creating).
- Set the tier key on creation (currently auto-derived only).
- Set "Xero files allowed" per tier (currently hardcoded to 1 for new tiers).
- Enable / disable a tier without deleting it.
- Keep the existing widget checkboxes, New tier button, and delete flow.

Renaming the page section header to "Client dashboard tiers" for consistency with the wording used elsewhere; the sidebar item stays where it is.

## Technical notes

- Files: `src/routes/_authenticated/admin.plans.tsx` (delete the second `LevelSection` and the dashboard branches in its dialog that are no longer reachable), `src/routes/_authenticated/settings.tiers.tsx` (add edit dialog fields).
- Both pages already use `savePlanLevel` / `deletePlanLevel` from `src/lib/plan-levels.functions.ts` against `plan_levels` (`scope = 'dashboard'`), so no schema or server-function changes are needed.
- `dashLevels` stays in `admin.plans.tsx` because the organisation-plan editor uses it for the `allowed_tiers` picker.
- Deleting a tier still strips it from firm plans and drops its widget settings (existing behaviour in `deletePlanLevel`).
