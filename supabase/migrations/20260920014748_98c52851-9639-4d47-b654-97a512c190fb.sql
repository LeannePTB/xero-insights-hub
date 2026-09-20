create policy mfa_aal2_required on public.org_card_defaults
  as restrictive for all to authenticated
  using (app_private.is_aal2())
  with check (app_private.is_aal2());