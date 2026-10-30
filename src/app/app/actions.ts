"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type FileKind = "markdown" | "code";

/**
 * Database errors are translated here rather than shown raw. The trigger
 * messages are stable strings, so matching them is safe and keeps the UI copy
 * in one place.
 */
function explain(message: string): string {
  if (/duplicate key|unique/i.test(message)) {
    return "Something with that name already exists here.";
  }
  if (/version_not_found/.test(message)) {
    return "That version no longer exists.";
  }
  if (/revision_conflict/.test(message)) {
    return "This file changed somewhere else. Reload it before saving.";
  }
  if (/quota_exceeded/.test(message)) {
    return "You're at the 25 MB limit. Delete some versions or empty the trash.";
  }
  if (/file_too_large/.test(message)) {
    return "That's over the 2 MB limit for a single file.";
  }
  if (/file_not_found/.test(message)) {
    return "That file no longer exists.";
  }
  if (/extension_required/.test(message)) {
    return "Code files need an extension, like .py or .js.";
  }
  if (/invalid_extension/.test(message)) {
    return "That extension isn't supported. Use .py, .java, .js, .html, .css, .cpp, .h, or .hpp.";
  }
  if (/invalid_(file|folder)_name/.test(message)) {
    return "That name isn't allowed. No slashes, and it can't be empty.";
  }
  if (/file_limit_reached/.test(message)) {
    return "You've reached the limit of 2,000 files.";
  }
  if (/folder_limit_reached/.test(message)) {
    return "You've reached the limit of 500 folders.";
  }
  if (/parent_not_owned|row-level security/i.test(message)) {
    return "That folder isn't yours.";
  }
  if (/parent_trashed/.test(message)) {
    return "The destination is in the trash.";
  }
  if (/folder_cycle/.test(message)) {
    return "A folder can't move inside itself.";
  }
  return "That didn't work. Try again.";
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createFolder(
  parentId: string | null,
  name: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .insert({
      owner_id: user.id,
      parent_id: parentId,
      name: name.trim(),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true, id: data.id };
}

export async function createFile(input: {
  folderId: string | null;
  name: string;
  kind: FileKind;
  language: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("files")
    .insert({
      owner_id: user.id,
      folder_id: input.folderId,
      name: input.name.trim(),
      kind: input.kind,
      language: input.kind === "code" ? input.language : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true, id: data.id };
}

export async function renameNode(
  kind: "folder" | "file",
  id: string,
  name: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const table = kind === "folder" ? "folders" : "files";
  const { error } = await supabase.from(table).update({ name: name.trim() }).eq("id", id);

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true };
}

export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; error: string };

export async function saveFile(
  fileId: string,
  content: string,
  expectedRevision: number,
): Promise<SaveResult> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_file", {
    p_file_id: fileId,
    p_content: content,
    p_expected_revision: expectedRevision,
  });

  if (error) return { ok: false, error: explain(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/app");
  return { ok: true, revision: (row?.revision as number | undefined) ?? expectedRevision + 1 };
}

export type VersionSummary = {
  id: string;
  source: "file" | "project" | "auto";
  label: string | null;
  byte_size: number;
  created_at: string;
  source_revision: number;
};

export async function listVersions(
  fileId: string,
): Promise<{ ok: true; versions: VersionSummary[] } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("versions")
    .select("id, source, label, byte_size, created_at, source_revision")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: explain(error.message) };
  return { ok: true, versions: (data ?? []) as VersionSummary[] };
}

/**
 * Returns the stored content. It does not write the file: the caller puts it
 * in the buffer, and the user decides whether to save it.
 */
export async function restoreVersion(
  versionId: string,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("restore_version", {
    p_version_id: versionId,
  });

  if (error) return { ok: false, error: explain(error.message) };
  revalidatePath("/app");
  return { ok: true, content: (data as string) ?? "" };
}

export async function deleteVersion(versionId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("versions").delete().eq("id", versionId);

  if (error) return { ok: false, error: explain(error.message) };
  revalidatePath("/app");
  return { ok: true };
}

export async function trashNode(
  kind: "folder" | "file",
  id: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("trash_node", {
    p_kind: kind,
    p_id: id,
  });

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true };
}
