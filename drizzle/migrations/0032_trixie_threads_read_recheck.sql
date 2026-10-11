drop policy "Owner reads own Trixie threads while access remains" on public.trixie_threads;
create policy "Owner reads own Trixie threads while access remains" on public.trixie_threads
  as permissive for select to authenticated
  using (
    user_id = auth.uid()
    and case workspace
      when 'client' then app_private.user_can_read_client(auth.uid(), client_id)
      when 'organisation' then app_private.has_firm_access(auth.uid(), firm_id)
      else true
    end
  );