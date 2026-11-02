"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type SuggestionCategory =
  | "feature"
  | "bug"
  | "performance"
  | "design"
  | "content"
  | "other";

export type SubmitResult = { ok: true } | { ok: false; error: string };

const CATEGORIES: SuggestionCategory[] = [
  "feature",
  "bug",
  "performance",
  "design",
  "content",
  "other",
];

/**
 * Files a suggestion. The user id comes from the session, never from the
 * caller, and RLS repeats the same check on the row.
 */
export async function submitSuggestion(input: {
  title: string;
  body: string;
  category: string;
}): Promise<SubmitResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to send a suggestion." };

  const title = input.title.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 4000);
  const category = (CATEGORIES as string[]).includes(input.category)
    ? (input.category as SuggestionCategory)
    : "feature";

  if (title.length < 3) {
    return { ok: false, error: "Give it a short title (at least 3 characters)." };
  }
  if (body.length < 3) {
    return { ok: false, error: "Add a sentence or two of detail." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suggestions").insert({
    user_id: user.id,
    title,
    body,
    category,
  });

  if (error) {
    if (/not_admin|permission denied|row-level security/i.test(error.message)) {
      return { ok: false, error: "You can only send suggestions as yourself." };
    }
    return { ok: false, error: "The suggestion could not be saved. Try again." };
  }

  revalidatePath("/settings/suggestions");
  revalidatePath("/settings/admin");
  return { ok: true };
}
