-- Error intake no longer trims inline.
--
-- /api/errors used to insert, then scan the newest 1000 ids and delete the
-- older half on every accepted request. That made an unauthenticated endpoint
-- do one insert plus one ordered scan per call, which is a cheap way to load a
-- shared database. Retention moves here instead.

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge-error-events') then
    perform cron.schedule(
      'purge-error-events',
      '20 3 * * *',
      $p$delete from public.error_events where created_at < now() - interval '30 days'$p$
    );
  end if;
end;
$$;
