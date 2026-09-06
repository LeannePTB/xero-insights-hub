REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.xero_connections FROM authenticated;

-- Why does this user have access to this organisation? Reuses the existing
-- app_private predicates so the rule keeps exactly one implementation.
CREATE OR REPLACE FUNCTION public.firm_access_path(_user_id uuid, _firm_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select case
    when _user_id is null or _firm_id is null then 'none'
    when app_private.has_firm_access(_user_id, _firm_id) then 'member'
    when app_private.platform_staff_can_access_firm(_user_id, _firm_id) then 'support_grant'
    else 'none'
  end
$$;

REVOKE ALL ON FUNCTION public.firm_access_path(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_access_path(uuid, uuid) TO service_role;