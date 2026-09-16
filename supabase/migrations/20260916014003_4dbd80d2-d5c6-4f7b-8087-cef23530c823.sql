create or replace function public.set_org_trial(
  _firm_id uuid,
  _advisory boolean,
  _consolidation boolean,
  _ends_at timestamptz,
  _reason text
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _prev record;
  _adv boolean := coalesce(_advisory, false);
  _con boolean := coalesce(_consolidation, false);
  _end timestamptz := _ends_at;
  _touched integer;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();

  if _reason is null or length(btrim(_reason)) < 3 then
    raise exception 'A reason is required.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;

  -- Ending a trial: no grants, no end date.
  if not _adv and not _con then
    _adv := false; _con := false; _end := null;
  else
    if _con and not _adv then
      raise exception 'CONSOLIDATION_REQUIRES_ADVISORY' using errcode = 'check_violation';
    end if;
    if _end is null or _end <= now() then
      raise exception 'TRIAL_END_MUST_BE_FUTURE' using errcode = 'check_violation';
    end if;
    if _end > now() + interval '120 days' then
      raise exception 'TRIAL_TOO_LONG' using errcode = 'check_violation';
    end if;
  end if;

  select coalesce(o.trial_advisory_enabled, false) as t_adv,
         coalesce(o.trial_consolidation_enabled, false) as t_con,
         o.trial_ends_at as t_end
    into _prev
    from public.org_subscription_options o
   where o.firm_id = _firm_id;

  -- Trial fields only: purchased options are never touched here.
  update public.org_subscription_options o
     set trial_advisory_enabled = _adv,
         trial_consolidation_enabled = _con,
         trial_ends_at = _end,
         updated_at = now()
   where o.firm_id = _firm_id;
  get diagnostics _touched = row_count;

  if _touched = 0 then
    insert into public.org_subscription_options
      (firm_id, trial_advisory_enabled, trial_consolidation_enabled, trial_ends_at)
    values (_firm_id, _adv, _con, _end);
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (
    auth.uid(), _firm_id, 'org_trial_set', 'firm', _firm_id::text,
    jsonb_build_object(
      'reason', btrim(_reason),
      'previous', jsonb_build_object(
        'advisory', coalesce(_prev.t_adv, false),
        'consolidation', coalesce(_prev.t_con, false),
        'ends_at', _prev.t_end
      ),
      'new', jsonb_build_object(
        'advisory', _adv,
        'consolidation', _con,
        'ends_at', _end
      )
    )
  );

  return _end;
end;
$function$;

revoke execute on function public.set_org_trial(uuid, boolean, boolean, timestamptz, text) from public, anon;
grant execute on function public.set_org_trial(uuid, boolean, boolean, timestamptz, text) to authenticated;