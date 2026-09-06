create or replace function public.set_client_tier_widgets(
  _client_id uuid,
  _tier text,
  _excluded text[],
  _clear boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $function$
declare
  _uid uuid := auth.uid();
  _firm_id uuid;
  _existing_id uuid;
begin
  -- Membership-only gate: the caller must own the client or be an active
  -- member of the client's organisation. Deliberately NOT
  -- app_private.user_can_manage_client, which admits read-only support grants.
  if _uid is null then
    raise exception 'NO_ACCESS' using errcode='insufficient_privilege';
  end if;

  select c.firm_id into _firm_id from public.clients c where c.id = _client_id;

  if not exists (
    select 1 from public.clients c
    where c.id = _client_id
      and (
        c.owner_user_id = _uid
        or (c.firm_id is not null and app_private.has_firm_access(_uid, c.firm_id))
      )
  ) then
    raise exception 'NO_ACCESS' using errcode='insufficient_privilege';
  end if;

  if _clear then
    delete from public.tier_widget_config
     where client_id = _client_id
       and tier = _tier;

    insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    values (_uid, _firm_id, 'client_widget_config_saved', 'tier_widget_config', _client_id::text,
            jsonb_build_object('tier', _tier, 'cleared', true));
    return;
  end if;

  select id into _existing_id
    from public.tier_widget_config
   where tier = _tier and client_id = _client_id;

  if _existing_id is not null then
    update public.tier_widget_config
       set excluded_widgets = _excluded
     where id = _existing_id;
  else
    insert into public.tier_widget_config (client_id, firm_id, tier, excluded_widgets)
    values (_client_id, null, _tier, _excluded);
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm_id, 'client_widget_config_saved', 'tier_widget_config', _client_id::text,
          jsonb_build_object('tier', _tier, 'excluded_widgets', _excluded));
end;
$function$;

revoke execute on function public.set_client_tier_widgets(uuid, text, text[], boolean) from public, anon;
grant execute on function public.set_client_tier_widgets(uuid, text, text[], boolean) to authenticated;