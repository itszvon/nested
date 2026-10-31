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
  if (/snapshot_not_found/.test(message)) {
    return "That snapshot no longer exists.";
  }
  if (/project_not_found/.test(message)) {
    return "That project no longer exists.";
  }
  if (/file_not_in_project/.test(message)) {
    return "One of those files isn't in this project any more.";
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

export type SnapshotSummary = {
  id: string;
  message: string | null;
  file_count: number;
  total_bytes: number;
  created_at: string;
};

export type SaveProjectItem = {
  fileId: string;
  content: string;
  expectedRevision: number;
};

export async function saveProject(
  projectId: string,
  message: string,
  items: SaveProjectItem[],
): Promise<{ ok: true; saved: number; skipped: number } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_project", {
    p_project_id: projectId,
    p_message: message,
    p_items: items.map((item) => ({
      file_id: item.fileId,
      content: item.content,
      expected_revision: item.expectedRevision,
    })),
  });

  if (error) return { ok: false, error: explain(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/app");
  return { ok: true, saved: row?.saved ?? 0, skipped: row?.skipped ?? 0 };
}

export async function listSnapshots(
  projectId: string,
): Promise<{ ok: true; snapshots: SnapshotSummary[] } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("snapshots")
    .select("id, message, file_count, total_bytes, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: explain(error.message) };
  return { ok: true, snapshots: (data ?? []) as SnapshotSummary[] };
}

export async function restoreProjectSnapshot(
  snapshotId: string,
): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("restore_project", {
    p_snapshot_id: snapshotId,
  });

  if (error) return { ok: false, error: explain(error.message) };
  revalidatePath("/app");
  return { ok: true, changed: (data as number) ?? 0 };
}

export type TrashItem = {
  kind: "folder" | "file";
  id: string;
  name: string;
  deleted_at: string;
  byte_size: number;
  days_left: number;
};

const TRASH_DAYS = 30;

/**
 * Top-level trashed items only. Children are carried inside their parent, so
 * the list stays short and restoring a folder brings its subtree with it.
 */
export async function listTrash(): Promise<
  { ok: true; items: TrashItem[] } | { ok: false; error: string }
> {
  await requireUser();
  const supabase = await createClient();

  const [folders, files] = await Promise.all([
    supabase
      .from("folders")
      .select("id, name, deleted_at, trash_root_id")
      .not("deleted_at", "is", null),
    supabase
      .from("files")
      .select("id, name, deleted_at, trash_root_id, byte_size")
      .not("deleted_at", "is", null),
  ]);

  if (folders.error) return { ok: false, error: explain(folders.error.message) };
  if (files.error) return { ok: false, error: explain(files.error.message) };

  const now = Date.now();
  const daysLeft = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).getTime() + TRASH_DAYS * 86400000 - now) / 86400000));

  const items: TrashItem[] = [
    ...(folders.data ?? [])
      .filter((row) => row.trash_root_id === row.id)
      .map((row) => ({
        kind: "folder" as const,
        id: row.id,
        name: row.name,
        deleted_at: row.deleted_at as string,
        byte_size: 0,
        days_left: daysLeft(row.deleted_at as string),
      })),
    ...(files.data ?? [])
      .filter((row) => row.trash_root_id === row.id)
      .map((row) => ({
        kind: "file" as const,
        id: row.id,
        name: row.name,
        deleted_at: row.deleted_at as string,
        byte_size: row.byte_size ?? 0,
        days_left: daysLeft(row.deleted_at as string),
      })),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));

  return { ok: true, items };
}

export async function restoreFromTrash(
  kind: "folder" | "file",
  id: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("restore_node", { p_kind: kind, p_id: id });
  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true };
}

export async function deleteForever(
  kind: "folder" | "file",
  id: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const table = kind === "folder" ? "folders" : "files";
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true };
}

export async function emptyTrash(): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("empty_trash");
  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  return { ok: true, removed: (data as number) ?? 0 };
}

export async function moveNode(
  kind: "folder" | "file",
  id: string,
  parentId: string | null,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("move_node", {
    p_kind: kind,
    p_id: id,
    p_new_parent: parentId,
    p_new_sort: 0,
  });

  if (error) return { ok: false, error: explain(error.message) };
  revalidatePath("/app");
  return { ok: true };
}

/** Current server copy of one file, for resolving a save conflict. */
export async function getFileSnapshot(
  fileId: string,
): Promise<{ ok: true; content: string; revision: number } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("files")
    .select("content, revision")
    .eq("id", fileId)
    .maybeSingle();

  if (error) return { ok: false, error: explain(error.message) };
  if (!data) return { ok: false, error: "That file no longer exists." };
  return { ok: true, content: data.content, revision: data.revision };
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
