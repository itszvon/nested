"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const STATUSES = ["new", "reviewing", "planned", "shipped", "declined"] as const;
type SuggestionStatus = (typeof STATUSES)[number];

function isStatus(value: string): value is SuggestionStatus {
  return (STATUSES as readonly string[]).includes(value);
}

/**
 * Moves a suggestion through the inbox and writes the private note that goes
 * with it. Admins only, enforced here and again by RLS. The note lives in its
 * own table so the author cannot read it back through the API.
 */
export async function updateSuggestion(input: {
  id: string;
  status: string;
  note: string;
}): Promise<AdminActionResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, error: "Only an admin can triage suggestions." };
  }
  if (!isStatus(input.status)) {
    return { ok: false, error: "Unknown status." };
  }

  const note = input.note.trim().slice(0, 2000);
  const supabase = await createClient();

  const { error } = await supabase
    .from("suggestions")
    .update({ status: input.status })
    .eq("id", input.id);

  if (error) {
    return { ok: false, error: "The suggestion could not be updated." };
  }

  if (note) {
    const { error: noteError } = await supabase
      .from("suggestion_notes")
      .upsert({ suggestion_id: input.id, note }, { onConflict: "suggestion_id" });

    if (noteError) {
      return { ok: false, error: "The status changed, but the note did not save." };
    }
  } else {
    await supabase.from("suggestion_notes").delete().eq("suggestion_id", input.id);
  }

  revalidatePath("/settings/admin");
  revalidatePath("/settings/suggestions");
  return { ok: true };
}

/** Permanent removal, for spam. The note is removed by the cascade. */
export async function deleteSuggestion(id: string): Promise<AdminActionResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, error: "Only an admin can delete suggestions." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suggestions").delete().eq("id", id);

  if (error) return { ok: false, error: "The suggestion could not be deleted." };

  revalidatePath("/settings/admin");
  return { ok: true };
}
