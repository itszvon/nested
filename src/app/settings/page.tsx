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

  const [profile, files, folders, fileRows, versionRows, folderRows] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, email, display_name, avatar, settings, storage_bytes")
      .maybeSingle(),
    supabase.from("files").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("folders").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("files")
      .select("id, name, project_id, byte_size")
      .is("deleted_at", null),
    supabase.from("versions").select("file_id, byte_size").limit(5000),
    supabase.from("folders").select("id, name").is("deleted_at", null),
  ]);

  const row = profile.data;

  // Storage is one number in the profile, but people need to know what is
  // taking it. Aggregate by project and by file, including version bytes.
  const folderNames = new Map((folderRows.data ?? []).map((folder) => [folder.id, folder.name]));
  const versionBytesByFile = new Map<string, number>();
  for (const version of versionRows.data ?? []) {
    versionBytesByFile.set(
      version.file_id,
      (versionBytesByFile.get(version.file_id) ?? 0) + version.byte_size,
    );
  }

  const projectTotals = new Map<string, number>();
  const fileTotals: Array<{ name: string; project: string; bytes: number }> = [];

  for (const file of fileRows.data ?? []) {
    const bytes = file.byte_size + (versionBytesByFile.get(file.id) ?? 0);
    const projectKey = file.project_id ?? "root";
    projectTotals.set(projectKey, (projectTotals.get(projectKey) ?? 0) + bytes);
    fileTotals.push({
      name: file.name,
      project: file.project_id ? folderNames.get(file.project_id) ?? "project" : "top level",
      bytes,
    });
  }

  const breakdown = {
    fileBytes: (fileRows.data ?? []).reduce((total, file) => total + file.byte_size, 0),
    versionBytes: (versionRows.data ?? []).reduce((total, version) => total + version.byte_size, 0),
    versionCount: versionRows.data?.length ?? 0,
    projects: [...projectTotals.entries()]
      .map(([id, bytes]) => ({ name: id === "root" ? "top level" : folderNames.get(id) ?? "project", bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5),
    files: fileTotals.sort((a, b) => b.bytes - a.bytes).slice(0, 5),
  };

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

      <div className="mx-auto max-w-4xl px-6 py-10">
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
          breakdown={breakdown}
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
