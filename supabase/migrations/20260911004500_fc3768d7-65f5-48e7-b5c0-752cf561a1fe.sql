-- Phase 1 (corrections 1, 2, 3): finish aal2 coverage.

-- 1. Restrictive aal2 guard on every remaining public table that
--    `authenticated` holds a privilege on, except plan_levels/tier_settings.
do $$
declare t text;
begin
  foreach t in array array[
    'tier_widget_config','security_settings','security_contact_details',
    'user_roles','email_send_state','email_unsubscribe_tokens',
    'rate_limit_buckets','suppressed_emails','xero_oauth_states'
  ] loop
    execute format(
      'create policy mfa_aal2_required on public.%I as restrictive for all to authenticated using (app_private.is_aal2()) with check (app_private.is_aal2())',
      t);
  end loop;
end $$;

-- 2. Correction 1: xero_missing_scopes is SECURITY DEFINER and reads
--    xero_connections for a caller-supplied id, so it needs the aal2 guard.
create or replace function public.xero_missing_scopes(_connection_id uuid)
 returns text[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when not app_private.is_aal2() then null
    when auth.uid() is not null and not exists (
      select 1 from public.xero_connections c
      where c.id = _connection_id
        and c.firm_id is not null
        and (
          app_private.has_firm_access(auth.uid(), c.firm_id)
          or app_private.platform_staff_can_access_firm(auth.uid(), c.firm_id)
        )
    ) then null
    else (
      select coalesce(array_agg(req), '{}')
      from unnest(public.xero_required_scopes()) as req
      where not exists (
        select 1 from public.xero_connections c,
                      unnest(string_to_array(coalesce(c.scopes,''), ' ')) as granted
        where c.id = _connection_id and granted = req
      )
    )
  end
$function$;

-- 3. service_role already bypasses RLS; granting EXECUTE only makes the
--    helper testable from system context. Matches app_private.has_firm_access.
grant execute on function app_private.is_aal2() to service_role;
grant execute on function app_private.assert_aal2() to service_role;
