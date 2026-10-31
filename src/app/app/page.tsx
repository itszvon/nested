import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getFile } from "@/lib/files";
import { getCurrentUser } from "@/lib/supabase/server";
import { readSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceRows } from "@/lib/workspace";
import { signOut } from "./actions";
import { CommandPalette } from "./command-palette";
import { FilePane } from "./file-pane";
import { SidebarShell } from "./sidebar-shell";
import { SidebarToggle } from "./sidebar-toggle";
import { WorkspaceTree } from "./tree";

export const metadata: Metadata = {
  title: "Nested",
};

// The shell needs the session and the tree before it can render anything.
export const instant = false;

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; versions?: string; r?: string }>;
}) {
  await connection();

  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [{ folders, files }, params, profile] = await Promise.all([
    getWorkspaceRows(),
    searchParams,
    supabase.from("profiles").select("display_name, avatar, settings").maybeSingle(),
  ]);

  const settings = readSettings(profile.data?.settings);

  const selectedId = params.f ?? null;
  const openFile = selectedId ? await getFile(selectedId) : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-rule px-3">
        <Link
          href="/home"
          aria-label="Nested home"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink hover:text-accent"
        >
          Nested
        </Link>
        <SidebarToggle />

        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/settings"
            aria-label="Account settings"
            title="Account settings"
            className="group flex h-7 items-center gap-2"
          >
            {profile.data?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.data.avatar}
                alt=""
                className="h-6 w-6 border border-rule object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center border border-rule font-mono text-[9px] uppercase text-ink-faint group-hover:border-rule-strong">
                {(profile.data?.display_name ?? user.email ?? "?").slice(0, 1)}
              </span>
            )}
            <span className="hidden max-w-[160px] truncate font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint group-hover:text-ink sm:inline">
              {profile.data?.display_name ?? user.email}
            </span>
          </Link>

          <span aria-hidden="true" className="h-4 w-px bg-rule" />

          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <CommandPalette folders={folders} files={files} />

      <div className="flex min-h-0 flex-1">
        <SidebarShell>
          <WorkspaceTree folders={folders} files={files} selectedId={selectedId} />
        </SidebarShell>

        {openFile ? (
          <FilePane
            key={`${openFile.id}:${params.r ?? "0"}`}
            file={openFile}
            userId={user.id}
            settings={settings}
            openVersions={params.versions === "1"}
          />
        ) : (
          <section className="flex min-w-0 flex-1 items-center justify-center px-6">
            <div className="max-w-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                no entry open
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
                {files.length === 0
                  ? "This account has no files yet. Create a project, then a file inside it."
                  : "Select a file from the left. Arrow keys navigate; Enter opens."}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
