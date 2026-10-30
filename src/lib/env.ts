/**
 * Environment access. Read through here so the failure mode is one clear
 * message instead of a stack of undefined-key errors from the SDK.
 */

export type SupabaseEnv = {
  url: string;
  key: string;
};

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();

  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return env;
}
