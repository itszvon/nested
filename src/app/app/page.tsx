import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Nested",
};

// The shell needs the session before it can render anything useful.
export const instant = false;

/**
 * Placeholder shell. Phases 3+ replace this with the sidebar and editor.
 * Its job right now is to prove the session survives a reload.
 */
export default async function AppPage() {
  // Always render per request: this page depends on the session, and must not
  // be baked into a static shell at build time.
  await connection();

  // Before setup is finished, show the login page's instructions instead of
  // throwing from inside the SDK.
  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-4">
        <span className="text-sm font-medium">Nested</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-500">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-500">
          Signed in. The tree and editor arrive in the next phases.
        </p>
      </div>
    </main>
  );
}
