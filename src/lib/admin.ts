import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in account is an admin.
 *
 * Read from the caller's own profile row. The column is not writable by
 * authenticated users (see the column-level grant in the profile_settings
 * migration), so this cannot be spoofed from the client.
 *
 * Wrapped in React's cache so a page that asks twice does one query.
 */
export const isCurrentUserAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .maybeSingle();

  if (error) return false;
  return data?.is_admin === true;
});
