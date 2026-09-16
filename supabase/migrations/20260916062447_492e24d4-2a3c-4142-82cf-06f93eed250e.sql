create or replace function public.client_org_trial(_client_id uuid)
returns table(trial_active boolean, trial_ends_at timestamp with time zone, days_remaining integer, ending_soon boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
begin
  perform app_private.assert_aal2();
  if auth.uid() is null or _client_id is null then return; end if;

  select c.firm_id into v_firm_id from public.clients c where c.id = _client_id;
  if v_firm_id is null then return; end if;

  -- Path A (active membership of the organisation) or Path E (a business_owner
  -- row for this exact client) only. External advisers, standing viewers and
  -- support grants never see billing state; anyone else gets no rows, which
  -- reveals nothing and lets the UI simply not render.
  if not (
    app_private.has_firm_access(auth.uid(), v_firm_id)
    or exists (
      select 1
      from public.client_access ca
      where ca.client_id = _client_id
        and ca.user_id = auth.uid()
        and ca.relationship = 'business_owner'
    )
  ) then
    return;
  end if;

  -- An expired or absent trial returns no rows: the dashboard reverts quietly
  -- and no banner is shown. Purchase state is deliberately not returned — this
  -- answers one question only: is a trial running, and when does it end.
  return query
    select e.trial_active,
           e.trial_ends_at,
           greatest(0, floor(extract(epoch from (e.trial_ends_at - now())) / 86400))::integer,
           (e.trial_ends_at <= now() + interval '14 days')
      from app_private.org_effective_options(v_firm_id) e
     where e.trial_active;
end;
$$;

revoke execute on function public.client_org_trial(uuid) from public, anon;
grant execute on function public.client_org_trial(uuid) to authenticated, service_role;