# Admin accounts

## Who is an admin

`public.profiles.is_admin`. The migration sets it for the operator's Google
account (`pothole3000@gmail.com`). Authenticated users have a column-level
grant for `display_name`, `avatar` and `settings` only, so the flag cannot be
set from the browser.

`public.is_admin()` is a security-definer helper used by the RLS policies.
`admin_overview()` and `admin_users()` are security-definer RPCs that raise
`not_admin` for anyone else.

## What exists today

`/settings/admin`, linked from Settings and from the app header for the admin
account only.

- **Overview** — accounts, files, folders, versions, storage, open suggestions,
  errors in the last 24 hours.
- **Suggestion inbox** — filter by open/all/status, change status
  (`new → reviewing → planned → shipped/declined`), write a private note, reopen,
  delete spam.
- **Accounts** — every profile with file count, storage, join date and last file
  edit. Read only.
- **Recent errors** — the newest 15 rows from `error_events`.

`/settings/suggestions` is the user-facing form and a list of that user's own
suggestions with their status. The admin note is never shown there.

Errors are admin-only now. The previous policy let every signed-in user read
every stack trace.

## Suggested next features for admin accounts

Ordered by value against the current codebase.

1. **Account actions** — disable sign-in for one account, force a version purge,
   or delete an account without the service-role SQL step. Needs a
   security-definer RPC per action and an audit row.
2. **Audit log** — append-only rows for admin actions (who changed what, when).
   Cheap to add now that there is one admin; painful to reconstruct later.
3. **Feature flags per account** — a jsonb column read alongside `settings`, to
   turn on experiments or turn off a costly feature for one user.
4. **Announcement banner** — one global message with a start/end date, shown in
   the app header. Useful for maintenance or a new language tier.
5. **Broadcast email** — send a notice to opted-in accounts. Requires the email
   provider, a queue table and an unsubscribe flag.
6. **Quota override** — per-account storage/file limits instead of the global
   25 MB / 2,000 files.
7. **Suggestion voting and a public roadmap** — users vote on open suggestions;
   shipped ones become a changelog page. The schema already has the status
   pipeline.
8. **Usage dashboard over time** — daily counts of sign-ups, files and runs,
   built from an events table rather than `count(*)` on every load.
9. **Sanctioned impersonation** — a read-only "view as" mode with an audit row,
   for reproducing a bug. Never write through it.
10. **Storage reclamation** — list orphaned versions and the largest accounts,
    with a one-click prune that respects the named-version rule.
11. **Abuse controls** — rate limits for sign-ups and remote runs are currently
    in-memory per instance. Move them to a table or Redis before opening sign-ups
    beyond a handful of people.
12. **Maintenance mode** — a flag that serves a holding page for `/app` while the
    database is being migrated.

## Adding a second admin

```sql
update public.profiles set is_admin = true where username = 'someone';
```

Removing the last admin locks the panel; make sure one remains. There is no
self-demotion UI on purpose.
