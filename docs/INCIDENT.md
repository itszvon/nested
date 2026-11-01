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

## 2-contain. Stop the bleeding

- **Bad deploy?** Vercel → Deployments → previous Ready → "Promote to Production".
  This is instant and does not touch the database.
- **Runaway code execution?** Set `NEXT_PUBLIC_RUNNER_ENABLED=false` in Vercel and
  redeploy. The Run button disappears and the panel refuses to start.
- **Abuse or leaked credentials?** Rotate the Supabase publishable key and the
  Brevo SMTP key; Supabase → Project Settings → API; Brevo → SMTP & API.
  Rotating the publishable key requires a redeploy.
- **Data corruption suspected?** Stop writes by promoting a maintenance deployment
  (or disabling sign-in) before touching rows.

## 3. Recover data

Backups are encrypted `pg_dump` files produced by `.github/workflows/backup.yml`
and stored as release assets in the private `nested-backups` repo.

1. Download the newest asset.
2. `age -d -i age-key.txt backup-YYYY-MM-DD.sql.gz.age | gunzip > backup.sql`
3. Restore into a scratch database locally:
   `createdb nested_restore && psql -d nested_restore -f backup.sql`
4. Verify: `PGHOST=localhost PGDATABASE=nested_restore PGPASSWORD=… npm run db:check`
5. Only then restore into production, and only after a fresh pre-restore dump.

If no backup exists, say so plainly — do not improvise a restore from memory.

## 4. Tell people

- The operator contact is `pothole3000@gmail.com` (published in
  `/.well-known/security.txt` and on `/security`).
- One user today (the owner), so "tell people" means tell yourself and record it.
- Post-incident: add a dated entry below with cause, impact, fix, and what would
  have caught it sooner.

## 5. Known defects

- Trash items older than 30 days are purged by `pg_cron` at 03:00 UTC. If the
  extension is disabled, they accumulate.
- Confirmation emails depend on Brevo's free tier (300/day) and a verified sender.
- The CSP allows `'unsafe-inline'` and `'unsafe-eval'` for Next.js hydration and
  the sandboxed runner. Accepted risk, documented in `PRODUCTION-AUDIT.md`.
- Vercel Hobby is non-commercial only.

## Incident log

| Date | Impact | Cause | Fix | Would have caught it sooner |
|---|---|---|---|---|
| — | — | — | — | — |
