import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getFile } from "@/lib/files";
import { getCurrentUser } from "@/lib/supabase/server";
import { getWorkspaceRows } from "@/lib/workspace";
import { signOut } from "./actions";
import { FilePane } from "./file-pane";
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

  const [{ folders, files }, params] = await Promise.all([
    getWorkspaceRows(),
    searchParams,
  ]);

  const selectedId = params.f ?? null;
  const openFile = selectedId ? await getFile(selectedId) : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-rule px-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
          Nested
        </span>
        <span className="hidden font-mono text-[10px] tracking-[0.08em] text-ink-faint sm:inline">
          {folders.length} folders · {files.length} files
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-[220px] truncate font-mono text-[10px] text-ink-faint sm:inline">
            {user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-rule bg-panel/50">
          <WorkspaceTree folders={folders} files={files} selectedId={selectedId} />
        </aside>

        {openFile ? (
          <FilePane
            key={`${openFile.id}:${params.r ?? "0"}`}
            file={openFile}
            userId={user.id}
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
