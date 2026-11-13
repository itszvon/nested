# Migrations when the hosted history is out of sync

## The situation

`supabase db push` refuses to run against the linked project:

```
Remote migration versions not found in local migrations directory.
...
supabase migration repair --status reverted 20261031154142 ... 20261111162308 --remote
```

The hosted project's `supabase_migrations.schema_migrations` table records
versions that were applied outside this repository (timestamps that do not match
any file in `supabase/migrations/`). The repo is the source of truth for the
schema; the history table is not.

**Do not run the suggested `migration repair --status reverted`.** It marks
those versions as reverted while their objects still exist, so the next push
would try to re-create tables that are already there.

## How to apply a migration

Use `db query`, which runs the file without touching the history table:

```powershell
cd "C:\Users\itszvon\OneDrive\Desktop\Pinned folders\Projects\Nested"
npx supabase db query --remote --yes -f supabase/migrations/<file>.sql
```

Check first that the migration is safe to re-run. Everything applied this way
must be idempotent: `create or replace function`, `create table if not exists`,
`do $$ ... if not exists ... $$` for schedules and policies. That is already the
house style for the recent migrations, so re-applying one is harmless.

Verify with a read-only query:

```powershell
npx supabase db query --remote --read-only "select proname, prosecdef from pg_proc where proname = '<function>';"
```

## Applied this way (2026-11-13)

| Migration | Verification |
|---|---|
| `20261113120000_identity_change_rpc.sql` | `set_my_username` and `set_my_email` exist, `prosecdef = true`, `authenticated` has execute |
| `20261113120100_purge_error_events.sql` | `cron.job` has `purge-error-events` at `20 3 * * *` |

## Reconciling history (optional, later)

If you want `db push` to work again:

1. Take a fresh backup first (`/api/cron/backup` writes one daily).
2. `npx supabase migration repair --status applied <version>` for each version
   the CLI reports as missing locally, **only after** confirming its objects
   exist in the hosted schema.
3. `npx supabase db pull --remote` writes a baseline migration matching the
   current hosted schema; review it before committing.

Until that is done, treat the CLI's migration commands as unusable and use
`db query` above.
