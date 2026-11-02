/**
 * Google OAuth, with Nested as the redirect origin.
 *
 * Supabase's hosted flow sends Google a callback on `<ref>.supabase.co`, and
 * Google's account chooser prints that host under "to continue to …". Routing
 * the authorization code through our own /auth/google/callback means the
 * chooser names this site instead.
 *
 * The Google token is exchanged for a Supabase session with the same
 * grant_type=id_token call that supabase.auth.signInWithIdToken uses, so no
 * second account system is introduced.
 *
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. When they are absent the
 * login action falls back to the hosted Supabase flow.
 */

import { createHash, randomBytes } from "node:crypto";
import { requireSupabaseEnv } from "@/lib/env";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const OAUTH_COOKIES = {
  state: "nested_oauth_state",
  verifier: "nested_oauth_verifier",
  nonce: "nested_oauth_nonce",
} as const;

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createOAuthAttempt() {
  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const nonce = base64url(randomBytes(24));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

  return { state, verifier, nonce, challenge };
}

export function googleRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/auth/google/callback`;
}

export function buildGoogleAuthUrl(input: {
  origin: string;
  state: string;
  challenge: string;
  nonce: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri(input.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return url.toString();
}

type GoogleTokens = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleCode(input: {
  code: string;
  verifier: string;
  origin: string;
}): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      code: input.code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(input.origin),
      grant_type: "authorization_code",
      code_verifier: input.verifier,
    }),
  });

  return (await response.json()) as GoogleTokens;
}

type SupabaseSession = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  msg?: string;
};

/**
 * Trades Google's ID token for a Supabase session. Mirrors
 * supabase.auth.signInWithIdToken, which is a browser-side call.
 */
export async function supabaseSessionFromIdToken(
  idToken: string,
  nonce: string,
): Promise<SupabaseSession> {
  const { url, key } = requireSupabaseEnv();

  const response = await fetch(`${url}/auth/v1/token?grant_type=id_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    cache: "no-store",
    body: JSON.stringify({
      provider: "google",
      id_token: idToken,
      nonce,
    }),
  });

  return (await response.json()) as SupabaseSession;
}
