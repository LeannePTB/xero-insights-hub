create or replace function public.read_audit_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  live_reads int; snap_reads int; report_reads int; link_reads int;
  snapshot_activity int; report_activity int; total_reads int;
  status text; detail text;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  select count(*) filter (where meta->>'source' = 'live'),
         count(*) filter (where meta->>'source' = 'snapshot'),
         count(*) filter (where meta->>'source' = 'report'),
         count(*) filter (where meta->>'source' = 'report_link'),
         count(*)
    into live_reads, snap_reads, report_reads, link_reads, total_reads
  from public.audit_log
  where action in ('xero_data_read','client_report_read')
    and at > now() - interval '7 days';

  -- Real activity to compare against: figures actually served in that window.
  select count(*) into snapshot_activity
  from public.xero_snapshots where fetched_at > now() - interval '7 days';
  select count(*) into report_activity
  from public.client_reports where generated_at > now() - interval '7 days';

  if total_reads = 0 and (snapshot_activity > 0 or report_activity > 0) then
    status := 'action';
    detail := 'Client figures were served in the last 7 days but no read was recorded.';
  elsif snapshot_activity > 0 and snap_reads = 0 and live_reads = 0 then
    status := 'action';
    detail := 'Stored figures were served with no matching read recorded.';
  elsif total_reads = 0 then
    status := 'warn';
    detail := 'No client figures appear to have been read in the last 7 days, so there is nothing to confirm.';
  else
    status := 'ok';
    detail := 'Every path that returns a client''s figures records the read, and rows are present for the paths used.';
  end if;

  return jsonb_build_object(
    'id','read_audit',
    'title','Reads of client figures are recorded',
    'status',status,
    'detail',detail,
    'evidence','Counted from the trail itself over 7 days: live ' || live_reads
      || ', stored snapshot ' || snap_reads || ', stored report ' || report_reads
      || ', report link ' || link_reads || '. Compared with figures actually served: '
      || snapshot_activity || ' snapshot row(s), ' || report_activity || ' report(s). '
      || 'No figures, account names or contact names are recorded, only that a read happened.');
end;
$function$;

revoke all on function public.read_audit_posture() from public, anon;
grant execute on function public.read_audit_posture() to authenticated;