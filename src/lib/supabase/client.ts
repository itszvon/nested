"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Browser client. Only used where the client genuinely needs Supabase
 * (for example auth state listeners). Data mutations go through server
 * actions so ownership checks live on the server.
 */
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}
