"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/site";

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
  if (/permission denied/i.test(message)) {
    return "This account isn't allowed to change that. Reload and try again.";
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
  // Back to the public page, not the sign-in form.
  redirect("/home");
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

/** Writes the sibling order for one parent in a single round trip. */
export async function reorderNodes(
  kind: "folder" | "file",
  parentId: string | null,
  ids: string[],
): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("reorder_nodes", {
    p_kind: kind,
    p_parent: parentId,
    p_ids: ids,
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


export type ProfileSummary = {
  username: string;
  email: string | null;
  displayName: string | null;
  avatar: string | null;
  settings: unknown;
};

export async function getProfile(): Promise<
  { ok: true; profile: ProfileSummary } | { ok: false; error: string }
> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("username, email, display_name, avatar, settings")
    .maybeSingle();

  if (error) return { ok: false, error: explain(error.message) };
  if (!data) return { ok: false, error: "No profile found." };

  return {
    ok: true,
    profile: {
      username: data.username,
      email: data.email,
      displayName: data.display_name,
      avatar: data.avatar,
      settings: data.settings,
    },
  };
}

export async function updateProfile(input: {
  displayName: string;
  avatar: string | null;
}): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const displayName = input.displayName.trim().slice(0, 60);

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      avatar: input.avatar,
    })
    .eq("id", (await requireUser()).id);

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  revalidatePath("/settings");
  return { ok: true };
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

/**
 * Both identity changes go through email. The provider's own wording is
 * translated here, because "email_provider_disabled" means nothing to a user
 * and it was previously swallowed by a generic message.
 */
function mailFailure(message: string): string {
  if (/email_provider_disabled|email logins are disabled/i.test(message)) {
    return "Email confirmation is switched off for this project, so no link could be sent.";
  }
  if (/rate|limit|too many/i.test(message)) {
    return "Too many confirmation emails were sent recently. Try again in a few minutes.";
  }
  if (/already|exists/i.test(message)) {
    return "That email is already connected to an account.";
  }
  if (/invalid/i.test(message)) {
    return "That email address was rejected.";
  }
  return `The confirmation email could not be sent: ${message}`;
}

/**
 * Starts a username change. Nothing is written to the profile here: a pending
 * request is stored, and a confirmation link goes to the account's email. The
 * change is applied only after that link is opened and confirmed.
 */
export async function requestUsernameChange(username: string): Promise<ActionResult> {
  const user = await requireUser();
  const clean = username.trim().replace(/^@+/, "").toLowerCase();

  if (!USERNAME_PATTERN.test(clean)) {
    return {
      ok: false,
      error: "Usernames are 3–32 characters: lowercase letters, digits and underscores.",
    };
  }

  if (!user.email) {
    return { ok: false, error: "This account has no email address to confirm with." };
  }

  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("username").maybeSingle();
  if (profile?.username === clean) {
    return { ok: false, error: "That is already your username." };
  }

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .maybeSingle();
  if (taken) return { ok: false, error: "That username is taken." };

  const { data: request, error } = await supabase
    .from("profile_change_requests")
    .insert({ owner_id: user.id, purpose: "username", payload: { username: clean } })
    .select("id")
    .single();

  if (error) return { ok: false, error: explain(error.message) };

  const origin = requestOrigin(await headers());
  const next = `/settings?confirm=${request.id}`;

  // A one-time link to the address already on the account. Opening it proves
  // control of the mailbox; the request row is what actually carries the change.
  const { error: mail } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (mail) {
    await supabase.from("profile_change_requests").delete().eq("id", request.id);
    return { ok: false, error: mailFailure(mail.message) };
  }

  return { ok: true, id: request.id };
}

/** Applies a pending username change after the emailed link was opened. */
export async function confirmUsernameChange(requestId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("profile_change_requests")
    .select("id, payload, expires_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) return { ok: false, error: explain(error.message) };
  if (!request) {
    return { ok: false, error: "That confirmation is no longer valid. Start again." };
  }

  if (new Date(request.expires_at).getTime() < Date.now()) {
    await supabase.from("profile_change_requests").delete().eq("id", request.id);
    return { ok: false, error: "That confirmation link expired. Start again." };
  }

  const username = (request.payload as { username?: string } | null)?.username ?? "";
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "That change is malformed. Start again." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  if (updateError) {
    if (/duplicate key|unique/i.test(updateError.message)) {
      return { ok: false, error: "That username is taken." };
    }
    return { ok: false, error: explain(updateError.message) };
  }

  await supabase.from("profile_change_requests").delete().eq("id", request.id);
  revalidatePath("/app");
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Starts an email change. Supabase emails the new address; nothing changes
 * until that link is opened. No address is typed twice: the mailbox is the
 * proof, not a string match.
 */
export async function changeEmail(newEmail: string): Promise<ActionResult> {
  const user = await requireUser();
  const next = newEmail.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
    return { ok: false, error: "That is not a valid email address." };
  }

  if (user.email && next === user.email.toLowerCase()) {
    return { ok: false, error: "That is already the email on this account." };
  }

  const supabase = await createClient();
  const origin = requestOrigin(await headers());
  const { error } = await supabase.auth.updateUser(
    { email: next },
    { emailRedirectTo: `${origin}/auth/callback?next=/settings` },
  );

  if (error) return { ok: false, error: mailFailure(error.message) };

  return { ok: true };
}

export async function updateEditorSettings(settings: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ settings })
    .eq("id", user.id);

  if (error) return { ok: false, error: explain(error.message) };

  revalidatePath("/app");
  revalidatePath("/settings");
  return { ok: true };
}

export async function exportAccountData(): Promise<
  { ok: true; json: string } | { ok: false; error: string }
> {
  await requireUser();
  const supabase = await createClient();

  const [folders, files, versions] = await Promise.all([
    supabase.from("folders").select("id, parent_id, name, sort_order, created_at"),
    supabase
      .from("files")
      .select("id, folder_id, name, kind, language, content, revision, created_at, updated_at")
      .is("deleted_at", null),
    supabase.from("versions").select("file_id, source, label, content, created_at").limit(5000),
  ]);

  const failure = folders.error ?? files.error ?? versions.error;
  if (failure) return { ok: false, error: explain(failure.message) };

  return {
    ok: true,
    json: JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        folders: folders.data ?? [],
        files: files.data ?? [],
        versions: versions.data ?? [],
      },
      null,
      2,
    ),
  };
}

/**
 * Deletes the signed-in account and everything belonging to it. The database
 * function runs as the table owner because deleting an auth user needs that
 * privilege, and it only ever touches the caller's own row.
 */
export async function deleteAccount(): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: explain(error.message) };

  await supabase.auth.signOut();
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
