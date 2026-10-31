import { createClient } from "@/lib/supabase/server";

export type OpenFile = {
  id: string;
  name: string;
  folder_id: string | null;
  kind: "markdown" | "code";
  language: string | null;
  content: string;
  revision: number;
  byte_size: number;
  updated_at: string;
  project_id: string | null;
};

/**
 * Content is fetched only for the file being opened, never for the whole tree.
 */
export async function getFile(id: string): Promise<OpenFile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("files")
    .select(
      "id, name, folder_id, kind, language, content, revision, byte_size, updated_at, project_id",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`file: ${error.message}`);
  return (data as OpenFile | null) ?? null;
}
