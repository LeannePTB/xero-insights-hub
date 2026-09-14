-- Companion to the assert_aal2 cut-off: lets the server middleware ask,
-- with the caller's own token, whether the session predates the most recent
-- 3am Australia/Sydney. Returns only a boolean; fail closed when the session
-- row cannot be found. System contexts (no claims / service_role) pass.

create or replace function public.session_fresh()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is null then true
    when coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) = 'service_role' then true
    else exists (
      select 1
      from auth.sessions s
      where s.id = nullif(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id',
        ''
      )::uuid
      and s.created_at >= ((timezone('Australia/Sydney', now())::date + interval '3 hours')
                           at time zone 'Australia/Sydney')
    )
  end
$function$;

revoke execute on function public.session_fresh() from public, anon;
grant execute on function public.session_fresh() to authenticated, service_role;