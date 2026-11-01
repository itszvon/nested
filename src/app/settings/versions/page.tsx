import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { getWorkspaceRows } from "@/lib/workspace";
import { VersionBrowser } from "./version-browser";

export const metadata: Metadata = {
  title: "Versions · Nested",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function VersionsPage() {
  await connection();

  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { folders, files } = await getWorkspaceRows();

  return (
    <div className="min-h-dvh">
      <header className="flex h-12 items-center gap-4 border-b border-rule px-4">
        <Link
          href="/settings"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
        >
          ← back to settings
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">Versions</span>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-6 max-w-2xl text-[12px] leading-relaxed text-ink-faint">
          Every save leaves a version, and every version can be named. Compare one against the
          current file, or two against each other, then apply either side. Applying writes a new
          revision, so nothing is lost.
        </p>

        <VersionBrowser folders={folders} files={files} />
      </div>
    </div>
  );
}
