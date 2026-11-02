import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { SuggestionForm, type SuggestionRow } from "./suggestion-form";

export const metadata: Metadata = {
  title: "Suggestions · Nested",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function SuggestionsPage() {
  await connection();

  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // The admin policy can read everything; this page is still "mine only".
  const { data } = await supabase
    .from("suggestions")
    .select("id, title, body, category, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="min-h-dvh">
      <header className="flex h-12 items-center gap-4 border-b border-rule px-4">
        <Link
          href="/settings"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
        >
          ← back to settings
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
          Suggestions
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="mb-8 max-w-prose text-[13px] leading-relaxed text-ink-dim">
          This is the product&rsquo;s own suggestion box, not a mail link. Your note is stored
          with your account so you can watch its status change, and the operator reads it in the
          admin panel.
        </p>

        <SuggestionForm suggestions={(data ?? []) as SuggestionRow[]} />
      </div>
    </div>
  );
}
