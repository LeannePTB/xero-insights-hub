# Phase 3a — support grants are read-only everywhere

Classification: SECURITY-RELEVANT (RLS, definer functions, server-function authorisation, support access).
Invariants: 5 (support grants read-only), 6 (one rule, in the database), 3, 9.

## Verified current state (11 Sep 2026, live)
- `app_private.user_can_manage_client` = client owner OR active membership OR (super admin AND active support grant). It is used only by READ policies plus `app_private.move_xero_file_to_client` and `app_private.user_can_read_client`.
- All other client write policies are already membership/owner-only inline expressions.
- One write policy admits a support grant: `staff manage client subscriptions` on `client_subscriptions` (`platform_staff_can_access_firm`). No member can write through it today (it needs super admin + grant).
- Write definer functions `delete_client_report`, `set_client_widget_enabled`, `set_client_tier_widgets` are already membership-only. `move_xero_file_to_client` is not.
- Server-side write paths that authorise through a support-admitting check: branding (organisation and client logo set/clear), report delivery (finalise, send, revoke, delete), monthly report draft save, Xero audit run and finding snooze/resolve/unsnooze, organisation Xero reconnect-all, loan-consolidation account writes, note report-flagging.
- `clearClientLogo` writes no audit row.

## Changes
1. Migration:
   - Add `app_private.user_can_write_client` (owner OR active membership) and aal2-guarded `public.user_can_write_client` / `public.user_can_write_firm` for server code.
   - Keep `user_can_manage_client` as the documented READ helper (all read policies keep it, plus the new support read paths).
   - `move_xero_file_to_client` uses the write helper for target and source.
   - Drop `staff manage client subscriptions` (support-grant-only write path; removes no member write).
   - Backlog 25: add the support path to the `clients` and `client_statutory_accounts` read policies only.
   - Rewrite the `support_write` posture check to scan real write paths: write policies and the sources of write helpers/write functions.
2. Server code: new `assertFirmWriteAccess` / `assertClientWriteAccess` helpers calling the database write functions; every write path above switches to them, reads keep support access. `clearClientLogo` writes an audit row. `userCanManageClient` in `xero/client-orgs.server.ts` becomes a call to the database write function.
3. Matrix and docs: support-grant reads on `clients` / `client_statutory_accounts` become allow; add deny rows for support-grant branding writes; remove known-failure markers 18 and 32 once proven; regenerate the fixture and matrix; update the backlog.

## Stop condition
No change may remove a write a member can perform today; member and client-viewer matrix rows must be identical before and after.
