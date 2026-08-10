# Remove the duplicate admin sidebar gap

## Confirmed cause

The parent `/admin` route already renders `AdminShell` around every admin child page. The Subscription Levels page renders another `AdminShell` inside that parent, so the sidebar component reserves a second 16rem-wide column. That empty reserved column is the large white gap shown in the screenshot.

## Plan

1. Remove the nested `AdminShell` wrappers from every state of the Subscription Levels page: loading, access denied, and normal content.
2. Let the existing `/admin` parent route remain the single owner of the sidebar and content inset.
3. Keep the plans content full-width with its current padding and horizontal table scrolling.
4. Verify the live page at desktop and mobile widths to confirm the heading and plan cards begin directly beside the single sidebar, with no duplicate gap or page-level overflow.

## Technical details

- Update only `src/routes/_authenticated/admin.plans.tsx`.
- No backend, subscription logic, or database changes.