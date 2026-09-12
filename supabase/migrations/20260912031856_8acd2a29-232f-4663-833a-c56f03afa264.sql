REVOKE EXECUTE ON FUNCTION app_private.enforce_client_limit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.enforce_xero_org_limit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.enforce_xero_org_limit_on_move() FROM PUBLIC, anon;