create or replace function app_private.confine_security_test_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _firm uuid;
  _test_firm uuid;
begin
  if tg_table_name = 'firms' then
    _uid := new.owner_user_id;
  elsif tg_table_name = 'firm_support_access' then
    _uid := new.grantee_user_id;
  else
    _uid := new.user_id;
  end if;

  if not app_private.is_security_test_account(_uid) then
    return new;
  end if;

  -- A test account may never hold practice-team membership or a support grant
  -- anywhere at all.
  if tg_table_name in ('practice_team', 'firm_support_access') then
    raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
  end if;

  -- user_roles is not organisation-scoped. A PLATFORM role on a test account
  -- is refused; client_viewer is expected for the viewer probe and allowed.
  if tg_table_name = 'user_roles' then
    if new.role in ('super_admin', 'advisor') then
      raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  _test_firm := app_private.security_test_firm_id();

  if tg_table_name = 'firms' then
    if new.is_test then return new; end if;
    raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
  end if;

  if tg_table_name = 'client_access' then
    select c.firm_id into _firm from public.clients c where c.id = new.client_id;
  else
    _firm := new.firm_id;
  end if;

  if _test_firm is null or _firm is null or _firm <> _test_firm then
    raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
  end if;
  return new;
end
$$;