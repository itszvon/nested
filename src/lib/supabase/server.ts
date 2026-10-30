import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 * Runs as the signed-in user; RLS decides what it can see.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the proxy instead.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null. Uses getClaims() so the token is verified
 * rather than merely read out of the cookie.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  return {
    id: data.claims.sub as string,
    email: (data.claims.email as string | undefined) ?? null,
  };
}
