import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  AdminPanel,
  type AdminOverview,
  type AdminSuggestion,
  type AdminUser,
} from "./admin-panel";

export const metadata: Metadata = {
  title: "Admin · Nested",
  robots: { index: false, follow: false },
};

export const instant = false;

const EMPTY_OVERVIEW: AdminOverview = {
  users: 0,
  admins: 0,
  files: 0,
  folders: 0,
  versions: 0,
  storage_bytes: 0,
  open_suggestions: 0,
  errors_24h: 0,
  suggestions: {},
};

export default async function AdminPage() {
  await connection();

  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Not an error page: a non-admin simply never sees this route.
  if (!(await isCurrentUserAdmin())) redirect("/settings");

  const supabase = await createClient();

  const [overview, users, suggestions, notes, errors] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_users"),
    supabase
      .from("suggestions")
      .select("id, user_id, title, body, category, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("suggestion_notes").select("suggestion_id, note"),
    supabase
      .from("error_events")
      .select("id, source, message, path, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const accounts = (users.data ?? []) as AdminUser[];
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const noteById = new Map(
    (notes.data ?? []).map((row) => [row.suggestion_id, row.note]),
  );

  const rows: AdminSuggestion[] = (suggestions.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    status: row.status,
    admin_note: noteById.get(row.id) ?? null,
    created_at: row.created_at,
    username: accountById.get(row.user_id)?.username ?? "unknown",
    email: accountById.get(row.user_id)?.email ?? null,
  }));

  return (
    <div className="min-h-dvh">
      <header className="flex h-12 items-center gap-4 border-b border-rule px-4">
        <Link
          href="/settings"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
        >
          ← back to settings
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">Admin</span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          {user.email ?? user.id.slice(0, 8)}
        </span>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-8 max-w-prose text-[13px] leading-relaxed text-ink-dim">
          Operator view. Suggestions arrive here with their author attached; the note field is
          private and never rendered for the user who sent it.
        </p>

        {overview.error ? (
          <p className="mb-6 border-l-2 border-red-500 pl-3 text-[12px] text-red-300">
            The overview could not be loaded: {overview.error.message}
          </p>
        ) : null}

        <AdminPanel
          overview={(overview.data as AdminOverview | null) ?? EMPTY_OVERVIEW}
          suggestions={rows}
          users={accounts}
          errors={errors.data ?? []}
        />
      </div>
    </div>
  );
}
