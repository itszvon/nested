import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Only routes that need a session.
 *
 * The proxy revalidates the auth token on every match, which is a round trip.
 * Running it on the marketing pages and the legal pages made them feel as slow
 * as the app while gaining nothing; those pages are public and static.
 */
export const config = {
  matcher: [
    "/",
    "/app/:path*",
    "/settings/:path*",
    "/login",
    "/auth/:path*",
    "/api/:path*",
  ],
};
