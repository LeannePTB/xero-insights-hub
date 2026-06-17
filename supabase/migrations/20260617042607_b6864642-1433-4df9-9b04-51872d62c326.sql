
REVOKE EXECUTE ON FUNCTION app_private.shares_firm_with(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.shares_firm_with(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION app_private.shares_firm_with(uuid, uuid) FROM anon;
