import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const instant = false;

/**
 * Root sends people where they belong: the app if there is a session, the
 * landing page otherwise. The landing page itself stays reachable at /home for
 * everyone, signed in or not.
 */
export default async function Root() {
  await connection();

  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/app");
  }

  redirect("/home");
}
