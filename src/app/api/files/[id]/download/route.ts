import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * One file, as a download. The project export is a zip; this is the "just give
 * me this file" case.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("files")
    .select("name, content")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return new Response("File not found", { status: 404 });

  // Quoted filename: strip anything that could break the header.
  const filename = data.name.replace(/["\\\r\n]/g, "-");

  return new Response(data.content ?? "", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
