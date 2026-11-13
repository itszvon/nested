import { NextResponse, type NextRequest } from "next/server";
import { desktopGuard } from "@/lib/desktop-guard";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Desktop builds expose this server on loopback, where any local process can
  // reach it. The guard is a no-op unless NESTED_DESKTOP_TOKEN is set.
  const guard = desktopGuard(request.headers, {
    token: process.env.NESTED_DESKTOP_TOKEN,
    host: process.env.NESTED_DESKTOP_HOST,
  });
  if (guard === "forbidden") {
    return new NextResponse("Forbidden", { status: 403 });
  }

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
