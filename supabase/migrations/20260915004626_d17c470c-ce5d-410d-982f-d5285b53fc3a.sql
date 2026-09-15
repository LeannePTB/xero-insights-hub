-- The Auth admin logout endpoint does not exist on this project (404 for both
-- POST /admin/users/{id}/logout and DELETE /admin/users/{id}/sessions), so this
-- function could audit an intent it cannot carry out. Removed rather than
-- shipped as a misleading control; see docs/security-backlog.md item 50.
DROP FUNCTION IF EXISTS public.admin_sign_out_all_devices(uuid);