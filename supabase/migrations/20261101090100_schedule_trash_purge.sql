-- Idempotent schedule: only create the job when it does not exist.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge-trash') then
    perform cron.schedule('purge-trash', '0 3 * * *', 'select public.purge_trash(30)');
  end if;
end;
$$;
