import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { readSettings } from "@/lib/settings";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings · Nested",
};

export const instant = false;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  await connection();

  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [profile, files, folders] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, email, display_name, avatar, settings, storage_bytes")
      .maybeSingle(),
    supabase.from("files").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("folders").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const row = profile.data;

  // Arriving from a confirmation email: show the change that is waiting, not
  // an auto-applied one. The click in the app is the last step.
  const params = await searchParams;
  let pendingUsername: { id: string; username: string } | null = null;

  if (params.confirm) {
    const { data } = await supabase
      .from("profile_change_requests")
      .select("id, payload, expires_at")
      .eq("id", params.confirm)
      .maybeSingle();

    const username = (data?.payload as { username?: string } | null)?.username;
    if (data && username && new Date(data.expires_at).getTime() > Date.now()) {
      pendingUsername = { id: data.id, username };
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-12 items-center gap-4 border-b border-rule px-4">
        <Link
          href="/app"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
        >
          ← back to files
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">Settings</span>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <SettingsForm
          profile={{
            username: row?.username ?? "",
            // The auth session is the source of truth: a confirmed email
            // change updates it, and the profiles copy catches up separately.
            email: user.email ?? row?.email ?? "",
            displayName: row?.display_name ?? "",
            avatar: row?.avatar ?? null,
          }}
          settings={readSettings(row?.settings)}
          pendingUsername={pendingUsername}
          usage={{
            storageBytes: Number(row?.storage_bytes ?? 0),
            files: files.count ?? 0,
            folders: folders.count ?? 0,
          }}
        />
      </div>
    </div>
  );
}
