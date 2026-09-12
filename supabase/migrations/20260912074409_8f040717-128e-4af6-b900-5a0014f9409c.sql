create table public.security_attestations (
  check_key text primary key,
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  note text,
  expires_after_days integer not null default 180,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_attestations_note_len check (note is null or length(note) <= 500),
  constraint security_attestations_expiry_sane check (expires_after_days between 1 and 730)
);

revoke all on table public.security_attestations from anon, authenticated;
grant select on table public.security_attestations to authenticated;
grant all on table public.security_attestations to service_role;

alter table public.security_attestations enable row level security;

create policy "attestations_select_super_admin"
  on public.security_attestations
  as permissive for select
  to authenticated
  using (app_private.me_is_super_admin());

create policy "mfa_aal2_required"
  on public.security_attestations
  as restrictive for all
  to authenticated
  using (app_private.is_aal2())
  with check (app_private.is_aal2());

create trigger security_attestations_audit
  after insert or update or delete on public.security_attestations
  for each row execute function public.audit_table_change();

create trigger security_attestations_touch
  before update on public.security_attestations
  for each row execute function public.tg_set_updated_at();

create or replace function public.record_security_attestation(_check_key text, _note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  attestable text[] := array['leaked_password'];
begin
  perform app_private.assert_aal2();
  if not app_private.is_super_admin(auth.uid()) then
    raise exception 'Not authorised.';
  end if;
  if _check_key is null or not (_check_key = any(attestable)) then
    raise exception 'That check cannot be attested.';
  end if;
  if _note is not null and length(_note) > 500 then
    raise exception 'Note is too long.';
  end if;

  insert into public.security_attestations (check_key, confirmed_by, confirmed_at, note)
  values (_check_key, auth.uid(), now(), nullif(btrim(coalesce(_note, '')), ''))
  on conflict (check_key) do update
    set confirmed_by = auth.uid(),
        confirmed_at = now(),
        note = nullif(btrim(coalesce(_note, '')), '');

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'security_attestation_recorded', 'security_attestation', _check_key,
          jsonb_build_object('check_key', _check_key, 'has_note', _note is not null));
end;
$$;

revoke all on function public.record_security_attestation(text, text) from public, anon;
grant execute on function public.record_security_attestation(text, text) to authenticated;