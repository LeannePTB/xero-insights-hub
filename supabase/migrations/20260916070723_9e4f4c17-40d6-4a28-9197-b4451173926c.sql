do $$
declare
  _firm_id uuid := 'cb63e0c4-4242-458a-ab7b-1e0d1853b814'::uuid;
  _actor_id uuid := '57d544ad-db50-4330-9b12-bcffdf4c6065'::uuid;
  _claims text;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = _actor_id and role = 'super_admin'
  ) then
    raise exception 'OWNER_IS_NOT_SUPER_ADMIN';
  end if;

  if not exists (
    select 1 from public.firms
    where id = _firm_id and name = 'DRTABT Projects'
  ) then
    raise exception 'NO_SUCH_ORGANISATION';
  end if;

  _claims := jsonb_build_object(
    'sub', _actor_id::text,
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '37fbd930-a636-4355-bb9b-33316bc87002'
  )::text;
  perform set_config('request.jwt.claims', _claims, true);

  perform public.set_org_trial(
    _firm_id,
    true,
    true,
    false,
    '2026-11-30T23:59:59+08:00'::timestamptz,
    'Owner requested genuine client demonstration trial ending 30 November 2026'
  );
end;
$$;

notify pgrst, 'reload schema';