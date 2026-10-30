import { createClient } from "@/lib/supabase/server";
import type { FileRow, FolderRow } from "@/lib/tree";

/**
 * Everything the sidebar needs, in two queries. RLS already limits rows to the
 * signed-in owner; the explicit owner filter is deliberately absent so a
 * missing policy fails loudly instead of silently returning an empty tree.
 */
export async function getWorkspaceRows(): Promise<{
  folders: FolderRow[];
  files: FileRow[];
}> {
  const supabase = await createClient();

  const [folders, files] = await Promise.all([
    supabase
      .from("folders")
      .select("id, parent_id, name, sort_order")
      .is("deleted_at", null),
    supabase
      .from("files")
      .select("id, folder_id, project_id, name, kind, language, revision, byte_size, updated_at")
      .is("deleted_at", null),
  ]);

  if (folders.error) throw new Error(`folders: ${folders.error.message}`);
  if (files.error) throw new Error(`files: ${files.error.message}`);

  return {
    folders: (folders.data ?? []) as FolderRow[],
    files: (files.data ?? []) as FileRow[],
  };
}
