import { strToU8, zipSync } from "fflate";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * A project as a zip of real files, for leaving, archiving, or opening in an
 * editor. The JSON export in Settings stays for machines; this one is for
 * people.
 *
 * The zip root is the project, so paths inside are the tree below it.
 */

const ILLEGAL = /[/\\:*?"<>|]/g;

function safeName(name: string): string {
  const cleaned = name.replace(ILLEGAL, "-").trim().slice(0, 120);
  // Dot segments are valid database names but not valid archive paths.
  if (cleaned.length === 0 || /^\.+$/.test(cleaned)) return "untitled";
  return cleaned;
}

function uniquePath(used: Set<string>, path: string): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }

  const dot = path.lastIndexOf(".");
  const base = dot > 0 ? path.slice(0, dot) : path;
  const extension = dot > 0 ? path.slice(dot) : "";

  let index = 2;
  let candidate = `${base} (${index})${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base} (${index})${extension}`;
  }

  used.add(candidate);
  return candidate;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const supabase = await createClient();

  const { data: root } = await supabase
    .from("folders")
    .select("id, name, parent_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!root) return new Response("Project not found", { status: 404 });

  const [folderRows, fileRows] = await Promise.all([
    supabase.from("folders").select("id, name, parent_id").is("deleted_at", null),
    supabase
      .from("files")
      .select("folder_id, name, content")
      .eq("project_id", id)
      .is("deleted_at", null),
  ]);

  if (folderRows.error || fileRows.error) {
    return new Response("Export failed", { status: 500 });
  }

  const folders = new globalThis.Map(
    (folderRows.data ?? []).map((row) => [row.id, row] as const),
  );

  // Walk up to the project root; the root itself becomes the zip root.
  function folderParts(folderId: string | null): string[] {
    const parts: string[] = [];
    let current = folderId;
    let guard = 0;

    while (current && current !== id && guard < 200) {
      const folder = folders.get(current);
      if (!folder) break;
      parts.unshift(safeName(folder.name));
      current = folder.parent_id;
      guard += 1;
    }

    return parts;
  }

  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();

  for (const file of fileRows.data ?? []) {
    const path = [...folderParts(file.folder_id), safeName(file.name)].join("/");
    entries[uniquePath(used, path)] = strToU8(file.content ?? "");
  }

  if (used.size === 0) {
    entries["README.txt"] = strToU8("This project is empty.\n");
  }

  const zip = zipSync(entries);
  const filename = `${safeName(root.name)}.zip`;

  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
