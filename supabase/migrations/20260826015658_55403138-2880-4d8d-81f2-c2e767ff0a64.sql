do $$
declare
  job_names text[] := array(
    select jobname
    from cron.job
    where jobname like 'xero-snapshot%'
  );
  j text;
begin
  foreach j in array job_names loop
    perform cron.unschedule(j);
  end loop;
end $$;

select cron.schedule(
  'xero-snapshot-refresh-daily',
  '5 * * * *',
  $$
    select net.http_post(
      url := 'https://www.tractionadvisory.com.au/api/public/xero/snapshot-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'xero-snapshot-refresh-daily'),
  active := true
);