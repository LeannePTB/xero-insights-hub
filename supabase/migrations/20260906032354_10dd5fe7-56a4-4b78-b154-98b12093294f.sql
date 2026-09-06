create or replace function public.set_platform_tier_widgets(_tier text, _excluded text[])
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  _uid uuid := auth.uid();
  _existing_id uuid;
begin
  if _uid is null or not app_private.me_is_super_admin() then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;

  select id into _existing_id
  from public.tier_widget_config
  where tier = _tier and client_id is null and firm_id is null;

  if _existing_id is not null then
    update public.tier_widget_config
    set excluded_widgets = _excluded
    where id = _existing_id;
  else
    insert into public.tier_widget_config (client_id, firm_id, tier, excluded_widgets)
    values (null, null, _tier, _excluded);
  end if;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (_uid, 'platform_tier_widgets_saved', 'tier_widget_config', _tier,
          jsonb_build_object('tier', _tier, 'excluded_widgets', _excluded));
end;
$$;

grant execute on function public.set_platform_tier_widgets(text, text[]) to authenticated;

create or replace function public.set_tier_enabled(_tier text, _enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null or not app_private.me_is_super_admin() then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;

  insert into public.tier_settings (tier, enabled)
  values (_tier, _enabled)
  on conflict (tier) do update set enabled = excluded.enabled;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (_uid, 'tier_enabled_changed', 'tier_settings', _tier,
          jsonb_build_object('tier', _tier, 'enabled', _enabled));
end;
$$;

grant execute on function public.set_tier_enabled(text, boolean) to authenticated;