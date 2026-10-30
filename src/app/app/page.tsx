import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { getWorkspaceRows } from "@/lib/workspace";
import { signOut } from "./actions";
import { WorkspaceTree } from "./tree";

export const metadata: Metadata = {
  title: "Nested",
};

// The shell needs the session and the tree before it can render anything.
export const instant = false;

function stamp(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
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
  const selected = selectedId ? files.find((file) => file.id === selectedId) ?? null : null;

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

        <section className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              {/* The ledger heading: what this entry is, and its numbers. */}
              <div className="flex h-11 shrink-0 items-center gap-4 border-b border-rule px-4">
                <span className="min-w-0 truncate text-[13px] text-ink">{selected.name}</span>

                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint md:inline">
                  {selected.kind === "code" ? selected.language : "text"}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-ink-faint md:inline">
                  rev {selected.revision}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-ink-faint lg:inline">
                  {selected.byte_size} B
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-ink-faint lg:inline">
                  {stamp(selected.updated_at)}
                </span>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled
                    title="Available once the editor lands"
                    className="h-7 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-40"
                  >
                    Save File
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Available once the editor lands"
                    className="h-7 border border-rule-strong px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim disabled:opacity-40"
                  >
                    Save Project
                  </button>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-center px-6">
                <p className="max-w-sm text-center text-[13px] leading-relaxed text-ink-faint">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                    {selected.kind === "code" ? "code file" : "text file"}
                  </span>
                  <br />
                  The editor arrives in the next phase. The tree, selection, and URL
                  are live now.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
