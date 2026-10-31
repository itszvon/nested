import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "@/lib/env";

/**
 * Protect by prefix rather than by listing public paths.
 *
 * The allow-list version redirected every unknown path to /login when signed
 * out, which meant 404s, robots.txt and sitemap.xml never resolved. Only /app
 * is private; everything else is either public or genuinely missing.
 */
const PROTECTED_PREFIXES = ["/app"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the auth token on every request and gates the app.
 * Next.js 16 calls this from proxy.ts. Server Components cannot write
 * cookies, so this is the only place the session is refreshed.
 */
export async function updateSession(request: NextRequest) {
  const env = readSupabaseEnv();

  // Before setup is finished there is nothing to authenticate against.
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Never trust getSession() here; getClaims() revalidates the token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!signedIn && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
