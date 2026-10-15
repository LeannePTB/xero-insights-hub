-- Demo organisations: a display-only flag. Ticked organisations are listed in
-- their own group at the bottom of the workspace switcher. Set only through
-- public.admin_set_firm_demo (aal2 + System Administrator, audited); the flag
-- grants no access and never changes any policy.
alter table public.firms add column if not exists is_demo boolean not null default false;

-- Seed the existing demo organisation.
update public.firms set is_demo = true
 where id = '5205df6d-44a6-470e-abb8-ddded645ad92'  -- Demo Practice
   and not is_demo;

CREATE OR REPLACE FUNCTION public.admin_set_firm_demo(_firm_id uuid, _is_demo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _old boolean;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _firm_id is null or _is_demo is null then raise exception 'INVALID_INPUT' using errcode = 'check_violation'; end if;
  select is_demo into _old from public.firms where id = _firm_id for update;
  if not found then raise exception 'NO_SUCH_FIRM' using errcode = 'no_data_found'; end if;
  update public.firms set is_demo = _is_demo where id = _firm_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'firm_changed_by_admin', 'firm', _firm_id,
          jsonb_build_object('field', 'is_demo', 'from', coalesce(_old, false), 'to', _is_demo));
end;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_firm_demo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_firm_demo(uuid, boolean) TO authenticated;