-- Trash is purged on a schedule, not by a user action.
-- pg_cron runs as the database owner, so purge_trash (revoked from
-- authenticated) can stay revoked while still running daily.
create extension if not exists pg_cron;
