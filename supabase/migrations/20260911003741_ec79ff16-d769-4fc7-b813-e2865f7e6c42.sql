create or replace function app_private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
      ''
    ) = 'aal2'
    -- System contexts (service role, cron, migrations) already bypass row
    -- level security entirely, so the MFA gate is not the control there.
    or coalesce(
         (select r.rolbypassrls from pg_roles r where r.rolname = current_user),
         false
       )
$$;