import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_COOKIES,
  exchangeGoogleCode,
  supabaseSessionFromIdToken,
} from "@/lib/google-oauth";
import { requestOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Google redirects here (not to Supabase) when GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET are set. The code is exchanged with Google, then the
 * ID token is exchanged for a Supabase session and written to the same
 * cookies the rest of the app already uses.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request.headers);
  const url = request.nextUrl;

  const googleError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const expectedState = request.cookies.get(OAUTH_COOKIES.state)?.value;
  const verifier = request.cookies.get(OAUTH_COOKIES.verifier)?.value;
  const nonce = request.cookies.get(OAUTH_COOKIES.nonce)?.value;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
    for (const name of Object.values(OAUTH_COOKIES)) response.cookies.delete(name);
    return response;
  };

  if (googleError || !code || !state || !expectedState || state !== expectedState) {
    return fail("exchange");
  }
  if (!verifier || !nonce) return fail("exchange");

  const tokens = await exchangeGoogleCode({ code, verifier, origin });
  if (!tokens.id_token) return fail("exchange");

  const session = await supabaseSessionFromIdToken(tokens.id_token, nonce);
  if (!session.access_token || !session.refresh_token) return fail("exchange");

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) return fail("exchange");

  const response = NextResponse.redirect(new URL("/app", origin));
  for (const name of Object.values(OAUTH_COOKIES)) response.cookies.delete(name);
  return response;
}
