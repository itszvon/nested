import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Two kinds of links land here:
 *
 * - OAuth sign-in returns a `code`, exchanged for a session.
 * - Email links (a changed address being confirmed) return a `token_hash` and
 *   a `type`, verified as an OTP. Without this branch the confirmation link
 *   would arrive and do nothing.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const requested = url.searchParams.get("next") ?? "/app";
  // Only relative paths, and never protocol-relative ones, so this cannot
  // become an open redirect.
  const destination =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (error) {
      return NextResponse.redirect(new URL("/login?error=exchange", url.origin));
    }

    return NextResponse.redirect(new URL(destination, url.origin));
  }

  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=exchange", url.origin));
  }

  // Only relative paths, so this cannot become an open redirect.
  return NextResponse.redirect(new URL(destination, url.origin));
}
