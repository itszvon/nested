"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  OAUTH_COOKIES,
  buildGoogleAuthUrl,
  createOAuthAttempt,
  googleOAuthConfigured,
} from "@/lib/google-oauth";
import { requestOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  const origin = requestOrigin(await headers());

  // Preferred: Google redirects to our own /auth/google/callback, so the
  // account chooser says "continue to <this site>", not the Supabase host.
  if (googleOAuthConfigured()) {
    const attempt = createOAuthAttempt();
    const store = await cookies();
    const options = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: origin.startsWith("https://"),
      path: "/",
      maxAge: 600,
    };

    store.set(OAUTH_COOKIES.state, attempt.state, options);
    store.set(OAUTH_COOKIES.verifier, attempt.verifier, options);
    store.set(OAUTH_COOKIES.nonce, attempt.nonce, options);

    redirect(
      buildGoogleAuthUrl({
        origin,
        state: attempt.state,
        challenge: attempt.challenge,
        nonce: attempt.nonce,
      }),
    );
  }

  // Fallback: the hosted Supabase flow. Works without extra configuration,
  // but Google shows the Supabase project host in the chooser.
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    redirect("/login?error=unavailable");
  }

  redirect(data.url);
}
