import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

/**
 * Daily logical backup into a private Storage bucket.
 *
 * Runs on the free tier with no vendor backup: every table is paginated into a
 * JSON document, gzipped, uploaded, then downloaded again and parsed to prove
 * the object is complete. Objects older than 30 days are pruned.
 *
 * Protected by CRON_SECRET; Vercel sends it automatically for cron requests.
 */

export const maxDuration = 60;

const TABLES = [
  "profiles",
  "folders",
  "files",
  "snapshots",
  "versions",
  "profile_change_requests",
] as const;

const RETENTION_DAYS = 30;
const PAGE = 1000;

type Row = Record<string, unknown>;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "backup is not configured" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function fetchAll(table: string): Promise<Row[]> {
    const rows: Row[] = [];
    let from = 0;

    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`${table}: ${error.message}`);

      const batch = (data ?? []) as Row[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }

    return rows;
  }

  try {
    const tables: Record<string, Row[]> = {};
    for (const table of TABLES) {
      tables[table] = await fetchAll(table);
    }

    const createdAt = new Date().toISOString();
    const payload = JSON.stringify({ version: 1, created_at: createdAt, tables });
    const compressed = gzipSync(Buffer.from(payload, "utf8"));
    const checksum = createHash("sha256").update(compressed).digest("hex");
    // Unique per run: reusing a path lets the storage CDN hand back the
    // previous object during verification.
    const stamped = createdAt.replace(/[:.]/g, "-");
    const path = `daily/${stamped}.json.gz`;

    const upload = await supabase.storage
      .from("backups")
      .upload(path, compressed, { contentType: "application/gzip", upsert: true });

    if (upload.error) throw new Error(`upload: ${upload.error.message}`);

    // Read it back and parse it: a backup that cannot be opened is not a backup.
    const download = await supabase.storage.from("backups").download(path);
    if (download.error || !download.data) {
      throw new Error(`verify download: ${download.error?.message ?? "empty"}`);
    }

    const verifyChecksum = createHash("sha256")
      .update(Buffer.from(await download.data.arrayBuffer()))
      .digest("hex");

    const parsed = JSON.parse(
      gunzipSync(Buffer.from(await download.data.arrayBuffer())).toString("utf8"),
    ) as { tables: Record<string, Row[]> };

    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      const expected = tables[table].length;
      const actual = parsed.tables[table]?.length ?? -1;
      if (expected !== actual) {
        throw new Error(`verify ${table}: expected ${expected}, found ${actual}`);
      }
      counts[table] = expected;
    }

    if (verifyChecksum !== checksum) {
      throw new Error("verify: checksum mismatch");
    }

    // Retention: delete objects older than 30 days.
    let pruned = 0;
    const listed = await supabase.storage.from("backups").list("daily", { limit: 100 });
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;

    for (const entry of listed.data ?? []) {
      const day = entry.name.slice(0, 10);
      const stamp = Date.parse(`${day}T00:00:00Z`);
      if (Number.isFinite(stamp) && stamp < cutoff) {
        const removed = await supabase.storage.from("backups").remove([`daily/${entry.name}`]);
        if (!removed.error) pruned += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      path,
      bytes: compressed.byteLength,
      checksum,
      counts,
      pruned,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
