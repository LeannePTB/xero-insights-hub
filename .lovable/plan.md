# Correct the Admin Organisations table

**Classification:** Security-relevant review, presentation-only implementation. View As is privileged, but its existing database checks and audit behaviour will not be changed.

## Changes

- Remove the complete Xero column from desktop and mobile organisation rows, including its data query and helper rendering.
- Keep Plan driven by the current organisation purchase settings, but remove the legacy `plan_levels` subtitle when the new card model is active.
- Keep the real billing mode text: “billed with bookkeeping” or “billed externally”.
- Put compact **Plan & members**, **Clients**, and super-admin-only **View As** controls directly in each row; leave only genuinely secondary actions in the overflow menu, or remove the empty menu.
- Preserve the existing View As flow and prominent “VIEWING AS” banner.
- Update the security backlog and roadmap wording to match the corrected table.

## Security evidence and verification

- Preserve `record_view_as` as the pre-navigation gate: AAL2, super admin, and existing active organisation membership are checked in the database.
- Preserve its `view_as_started` audit row naming actor, organisation, optional client, mode, and time.
- Preserve invariant 3: View As grants no data access; a super admin without another valid access path remains denied.
- Run the full security check so every existing access-matrix row is re-proved, then check the resulting table at desktop and mobile widths.
