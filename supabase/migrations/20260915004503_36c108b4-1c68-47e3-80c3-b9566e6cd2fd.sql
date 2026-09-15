-- The app_private schema is not exposed over the Data API, so this is only
-- reachable from inside the database (row level security policies and the
-- aal2 helpers). Without it, every policy that consults is_aal2() fails with a
-- permission error instead of denying cleanly. Mirrors is_session_fresh().
GRANT EXECUTE ON FUNCTION app_private.is_session_active() TO authenticated, service_role;