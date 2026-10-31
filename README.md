# Nested

Notes and code, in folders inside folders. Google sign-in, private by default,
manual saves with per-file version history, a 30-day trash, and nothing ever
written to the database without a button press.

- [docs/SPEC.md](docs/SPEC.md) — what the app does
- [docs/PLAN.md](docs/PLAN.md) — how it gets built, phase by phase

## Setup (one time)

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) on the free plan.
   Pick the region closest to you.
2. Project Settings → API. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never use the secret key in this app. It has no business in the browser.

### 2. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com), create a project.
2. OAuth consent screen: External, add your own email as a test user while the
   app is unverified.
3. Credentials → Create credentials → OAuth client ID → Web application.
4. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. In Supabase: Authentication → Providers → Google. Enable it and paste the
   client ID and secret.
6. In Supabase: Authentication → URL Configuration.
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
   - Add the production URLs when the app is deployed.
7. In Supabase: Authentication → Sign In / Providers. Disable everything except
   Google, including email and anonymous sign-in.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in the two Supabase values. Sentry keys are optional.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |


## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Browser-safe API key |
| `NEXT_PUBLIC_SITE_URL` | production | Canonical origin used by the sitemap and legal pages |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Browser error reporting; no-op when absent |
| `SENTRY_DSN` | optional | Server error reporting |

Values live in `.env.local`, which is gitignored. `.env.example` lists the names only.

A `PGPASSWORD` environment variable is needed for `npm run db:check`; it is the
database password, not an API key.

## Operations

Honest state of each procedure, because a runbook that describes things that do
not exist is worse than no runbook.

| Procedure | State |
|---|---|
| Local setup | Works, see above |
| Migrations | `npx supabase db push` against the linked project. Two-step when adding enum values, see [docs/adding-a-language.md](docs/adding-a-language.md) |
| Production deploy | Not performed. `/home` must be in the Supabase redirect allow list and `NEXT_PUBLIC_SITE_URL` set before the first deploy |
| Backups | Not implemented. Supabase free tier has none; a nightly logical dump is planned and not built |
| Restore | Untested. Requires the backup that does not exist yet |
| Monitoring | `/api/health` is wired and returns 200; no external monitor alerts anyone yet |
| Error reporting | Sentry code present, no DSN configured, nothing sent |
| Incident response | Not documented. Single operator |

## What exists so far

Phase 0 only: authentication, the route gate, and a placeholder shell.

- `/login` — Google sign-in, with a setup hint when environment variables are missing
- `/auth/callback` — OAuth exchange
- `/app` — signed-in placeholder, proves the session survives a reload
- `/api/health` — keep-alive and uptime probe, hit daily by a Vercel cron
