-- The demo marking is a System Administrator display aid only. A member of a demo
-- organisation must not learn their organisation is marked as one, so the flag is
-- resolved here, in the database: the real value only for a System Administrator,
-- false for everybody else. Display only — it grants no access to anything.
create or replace function public.my_firm_demo_flags()
 returns table(firm_id uuid, is_demo boolean)
 language sql
 stable
 security invoker
 set search_path = public
as $$
  select f.id,
         case when public.me_is_super_admin() then coalesce(f.is_demo, false) else false end
  from public.firms f
$$;

comment on function public.my_firm_demo_flags() is
  'Caller-scoped demo marking: the real value only for a System Administrator (aal2), false for everyone else. Display only; grants no access.';

revoke execute on function public.my_firm_demo_flags() from public, anon;
grant execute on function public.my_firm_demo_flags() to authenticated, service_role;