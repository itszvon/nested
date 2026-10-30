# Nested

Notes and code, in folders inside folders. Google sign-in, private by default,
manual saves with per-file version history, a 30-day trash, and nothing ever
written to the database without a button press.

- [SPEC.md](SPEC.md) — what the app does
- [PLAN.md](PLAN.md) — how it gets built, phase by phase

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

## What exists so far

Phase 0 only: authentication, the route gate, and a placeholder shell.

- `/login` — Google sign-in, with a setup hint when environment variables are missing
- `/auth/callback` — OAuth exchange
- `/app` — signed-in placeholder, proves the session survives a reload
- `/api/health` — keep-alive and uptime probe, hit daily by a Vercel cron
