# Incident runbook

One page. Written so somebody other than the author can act.

## 1. Is it down?

| Check | Command / URL | Expected |
|---|---|---|
| Health | `curl -s https://nestedforyou.vercel.app/api/health` | `{"ok":true,"database":200}` |
| Landing | `https://nestedforyou.vercel.app/home` | 200 |
| App gate | `https://nestedforyou.vercel.app/app` signed out | 307 to `/login` |
| Smoke suite | `npm run smoke` | all PASS |
| Vercel status | dashboard → project `nested` → Deployments | latest Ready |
| Supabase status | https://status.supabase.com | operational |

If `/api/health` returns 200 but `database` is not 200, the problem is Supabase,
not the app. If the domain 404s with `DEPLOYMENT_NOT_FOUND`, the domain alias is
detached: Vercel → project → Domains.

## 2. Contain

- **Bad deploy?** Vercel → Deployments → previous Ready → "Promote to Production".
  Instant, no database change.
- **Runaway code execution?** Set `NEXT_PUBLIC_RUNNER_ENABLED=false` in Vercel and
  redeploy. The Run button disappears and the panel refuses to start.
- **Leaked credentials?** Rotate the Supabase publishable key, the service-role
  key and the Brevo SMTP key; rotating keys requires a redeploy.
- **Data corruption suspected?** Stop writes before touching rows.

## 3. Recover data

Backups: `/api/cron/backup` runs daily at 03:00 UTC (Vercel cron), writing a
gzipped JSON dump of every table to the **private** `backups` Storage bucket as
`daily/<timestamp>.json.gz`, verifying it by re-downloading and comparing
checksums and row counts, and pruning objects older than 30 days.

Run one by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://nestedforyou.vercel.app/api/cron/backup
```

Restore drill (tested 2026-11-01, PASS — all row counts matched):

```python
# 1. download the object with the service-role key
#    GET /storage/v1/object/backups/daily/<file>.json.gz
# 2. parse it, then, in a scratch schema:
#    create table restore_drill.<t> (like public.<t> including all)
#    insert into restore_drill.<t>
#      select * from jsonb_populate_recordset(null::public.<t>, %s::jsonb)
# 3. compare counts per table, then drop schema restore_drill cascade
```

For a full production restore: stop writes, take a fresh pre-restore backup,
restore into a scratch database first, then truncate and reload production in
dependency order (profiles → folders → files → snapshots → versions).

If no backup object exists, say so plainly — do not improvise a restore.

## 4. Tell people

- Operator contact: `pothole3000@gmail.com`, published in
  `/.well-known/security.txt` and on `/security`.
- One user today (the owner), so "tell people" means record it.
- Post-incident: add a dated entry below with cause, impact, fix and what would
  have caught it sooner.

## 5. Known defects and limits

- **Error reporting is first-party.** Server and client errors land in
  `error_events` (Settings → Errors, newest 10). There is no third-party alerting;
  check the table after a suspected incident. Sentry is optional if a DSN is set.
- **Uptime alerting** is a GitHub Actions workflow every 15 minutes
  (`.github/workflows/uptime.yml`); a failed run emails the repository owner.
  It depends on GitHub notifications being enabled.
- Trash is purged by `pg_cron` at 03:00 UTC; if the extension is disabled items
  accumulate.
- Confirmation emails depend on Brevo's free tier (300/day) and a verified sender.
- The CSP allows `'unsafe-inline'` and `'unsafe-eval'` for Next.js hydration and
  the sandboxed runner. Accepted risk (documented in `PRODUCTION-AUDIT.md`).
- Vercel Hobby is non-commercial only.

## Incident log

| Date | Impact | Cause | Fix | Would have caught it sooner |
|---|---|---|---|---|
| 2026-11-01 | none | Backup verification flagged a checksum mismatch when re-uploading the same object path (CDN cache). | Unique timestamped paths per backup run. | The backup's own verify step caught it before it mattered. |
