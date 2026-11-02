# Making Google say "Nested" instead of the Supabase host

Google's account chooser prints the host of the OAuth redirect URI:

> to continue to **purcbbalpuovesdndlik.supabase.co**

That host comes from Supabase's hosted callback. Supabase Free cannot serve
auth on a custom domain, so Nested now runs the Google leg itself and sends the
code to its own `/auth/google/callback`. The chooser then names this site.

## What the code does

1. `src/app/login/actions.ts` — when `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` are set, it creates a state, PKCE verifier and nonce,
   stores them in three ten-minute HttpOnly cookies, and redirects to Google
   with `redirect_uri=<origin>/auth/google/callback`.
2. `src/app/auth/google/callback/route.ts` — checks the state, exchanges the
   code with Google, then trades the ID token for a Supabase session through
   `POST /auth/v1/token?grant_type=id_token` (the same call
   `supabase.auth.signInWithIdToken` makes in a browser).
3. `supabase.auth.setSession` writes the normal Supabase cookies, so the rest
   of the app is unchanged.

Without those two environment variables, the old Supabase-hosted flow is used
as a fallback. The app keeps working either way.

## The one manual step

In **Google Cloud Console → APIs & Services → Credentials → the Nested OAuth
client → Authorized redirect URIs**, add both:

```
https://nestedforyou.vercel.app/auth/google/callback
http://localhost:3000/auth/google/callback
```

Keep the existing `https://purcbbalpuovesdndlik.supabase.co/auth/v1/callback`
entry so the fallback and Supabase's own provider configuration keep working.

The OAuth consent screen also shows the app name ("Nested"). That comes from
the consent screen configuration, not from code.

## Environment

Add these where the app runs (Vercel → Settings → Environment Variables, and
`.env.local` for local development):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

They are the same client ID and secret already configured in the Supabase
Google provider. Supabase validates the ID token against that provider, so the
two must stay identical.

## If you move to a custom domain

Add the new origin to the redirect URI list before pointing DNS at it. The
callback URL is derived from the request's forwarded host, so no code change is
needed. If you later upgrade Supabase to Pro and enable its custom domain, you
can also return to the hosted flow by removing the two environment variables.

## Verifying

1. Sign out, press Continue with Google.
2. The chooser should read "to continue to nestedforyou.vercel.app" (or
   localhost during development).
3. Finish the sign-in and confirm `/app` loads and the session survives a
   reload.
4. If it fails, `/login?error=exchange` means the state, code exchange or ID
   token exchange failed. Check the redirect URI list first.
