create table public.platform_branding (
  id boolean primary key default true check (id),
  product_name text check (product_name is null or char_length(product_name) between 1 and 80),
  logo_light text check (logo_light is null or (logo_light ~ '^data:image/(png|jpeg|webp|svg\+xml);base64,' and char_length(logo_light) <= 400000)),
  logo_dark text check (logo_dark is null or (logo_dark ~ '^data:image/(png|jpeg|webp|svg\+xml);base64,' and char_length(logo_dark) <= 400000)),
  favicon text check (favicon is null or (favicon ~ '^data:image/(png|x-icon|vnd.microsoft.icon|svg\+xml);base64,' and char_length(favicon) <= 200000)),
  email_sender_name text check (email_sender_name is null or char_length(email_sender_name) between 1 and 80),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
revoke all on table public.platform_branding from public, anon, authenticated;
grant all on table public.platform_branding to service_role;
alter table public.platform_branding enable row level security;
comment on table public.platform_branding is 'Platform-wide display branding (Path C metadata). No direct grants; read via get_platform_branding(), write via save_platform_branding().';

create or replace function public.get_platform_branding()
returns table (product_name text, logo_light text, logo_dark text, favicon text, email_sender_name text, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select b.product_name, b.logo_light, b.logo_dark, b.favicon, b.email_sender_name, b.updated_at
  from public.platform_branding b where b.id = true
$$;
revoke execute on function public.get_platform_branding() from public;
grant execute on function public.get_platform_branding() to anon, authenticated, service_role;

create or replace function public.save_platform_branding(
  _product_name text, _logo_light text, _logo_dark text, _favicon text, _email_sender_name text
) returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'Forbidden';
  end if;
  insert into public.platform_branding as b (id, product_name, logo_light, logo_dark, favicon, email_sender_name, updated_at, updated_by)
  values (true, nullif(btrim(_product_name), ''), _logo_light, _logo_dark, _favicon, nullif(btrim(_email_sender_name), ''), now(), auth.uid())
  on conflict (id) do update set
    product_name = excluded.product_name, logo_light = excluded.logo_light, logo_dark = excluded.logo_dark,
    favicon = excluded.favicon, email_sender_name = excluded.email_sender_name,
    updated_at = now(), updated_by = auth.uid();
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'platform_branding_saved', 'platform_branding', 'platform',
    jsonb_build_object('has_product_name', _product_name is not null, 'has_logo_light', _logo_light is not null,
      'has_logo_dark', _logo_dark is not null, 'has_favicon', _favicon is not null, 'has_sender', _email_sender_name is not null));
end;
$$;
revoke execute on function public.save_platform_branding(text, text, text, text, text) from public, anon;
grant execute on function public.save_platform_branding(text, text, text, text, text) to authenticated;