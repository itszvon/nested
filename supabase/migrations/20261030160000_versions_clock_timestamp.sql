-- `now()` is fixed for the whole transaction, so every version written by one
-- save_project shares a timestamp and "the latest version" becomes an
-- arbitrary choice. The duplicate check then compares against the wrong row
-- and writes redundancies. clock_timestamp() advances per statement.

begin;

alter table public.versions
  alter column created_at set default clock_timestamp();

commit;
