create or replace function app_private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    -- No HTTP request context: cron, migrations, direct maintenance. These are
    -- system contexts, not a signed-in person.
    when nullif(current_setting('request.jwt.claims', true), '') is null then true
    -- Service role (webhooks, OAuth callback, email queue, nightly refresh)
    -- already bypasses row level security, so MFA is not the control there.
    when coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) = 'service_role' then true
    else coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
           ''
         ) = 'aal2'
  end
$$;