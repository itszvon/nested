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

export default async function SettingsPage() {
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
            // profiles is kept in step by the confirmation action, so it is
            // fresher than the session token right after a change.
            email: row?.email ?? user.email ?? "",
            displayName: row?.display_name ?? "",
            avatar: row?.avatar ?? null,
          }}
          settings={readSettings(row?.settings)}
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
