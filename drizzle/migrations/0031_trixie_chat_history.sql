create table public.trixie_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  firm_id uuid references public.firms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  workspace text not null check (workspace in ('system','general','organisation','client')),
  title text not null default 'New chat' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trixie_threads_scope check (
    (workspace in ('system','general') and firm_id is null and client_id is null)
    or (workspace = 'organisation' and firm_id is not null and client_id is null)
    or (workspace = 'client' and client_id is not null)
  )
);
create index trixie_threads_user_updated on public.trixie_threads (user_id, updated_at desc);
create index trixie_threads_client on public.trixie_threads (client_id);
create index trixie_threads_firm on public.trixie_threads (firm_id);

create table public.trixie_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.trixie_threads(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  created_at timestamptz not null default now()
);
create index trixie_messages_thread_created on public.trixie_messages (thread_id, created_at);

revoke all on table public.trixie_threads from anon, authenticated, public;
revoke all on table public.trixie_messages from anon, authenticated, public;
grant select, insert, delete on table public.trixie_threads to authenticated;
grant update (title, updated_at) on table public.trixie_threads to authenticated;
grant select, insert on table public.trixie_messages to authenticated;
grant all on table public.trixie_threads to service_role;
grant all on table public.trixie_messages to service_role;

alter table public.trixie_threads enable row level security;
alter table public.trixie_messages enable row level security;

create policy mfa_aal2_required on public.trixie_threads as restrictive for all to authenticated using (app_private.is_aal2()) with check (app_private.is_aal2());
create policy mfa_aal2_required on public.trixie_messages as restrictive for all to authenticated using (app_private.is_aal2()) with check (app_private.is_aal2());

-- Owner only, and only while the owner can STILL read the client/organisation.
create policy "Owner reads own Trixie threads while access remains" on public.trixie_threads
  as permissive for select to authenticated
  using (
    user_id = auth.uid()
    and case workspace
      when 'client' then app_private.has_client_read_access(auth.uid(), client_id)
      when 'organisation' then app_private.has_firm_access(auth.uid(), firm_id)
      else true
    end
  );
create policy "Owner creates own Trixie threads" on public.trixie_threads
  as permissive for insert to authenticated
  with check (user_id = auth.uid());
create policy "Owner renames own Trixie threads" on public.trixie_threads
  as permissive for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner deletes own Trixie threads" on public.trixie_threads
  as permissive for delete to authenticated
  using (user_id = auth.uid());

-- Messages are visible only through a thread the owner can still see.
create policy "Owner reads messages of own visible threads" on public.trixie_messages
  as permissive for select to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.trixie_threads t where t.id = thread_id));
create policy "Owner appends to own visible threads" on public.trixie_messages
  as permissive for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.trixie_threads t where t.id = thread_id and t.user_id = auth.uid()));

-- "Delete all my chats", including threads now hidden because access was removed.
create or replace function public.delete_all_my_trixie_threads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.trixie_threads where user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end
$$;
revoke execute on function public.delete_all_my_trixie_threads() from public, anon;
grant execute on function public.delete_all_my_trixie_threads() to authenticated, service_role;

comment on table public.trixie_threads is 'Trixie chat threads. Owner-only; hidden when the owner can no longer read the client/organisation. Kept until deleted; cascades with the client, organisation or user.';
comment on table public.trixie_messages is 'Visible Trixie message text and the Sources used list only; never tool payloads.';