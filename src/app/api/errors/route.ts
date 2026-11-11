import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Client error intake. Writes through the service role, so no browser can read
 * or inject events directly (RLS has no insert policy at all).
 *
 * Deliberately tolerant: a broken page must never produce a second error here.
 * Everything is capped, and the table is trimmed to the newest 500 events.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const MAX_GLOBAL_PER_WINDOW = 200;

const seen = new Map<string, number[]>();

// A process-wide ceiling keeps a rotating forwarding header from turning an
// unauthenticated intake into unbounded service-role writes.
let globalWindowStart = 0;
let globalCount = 0;

function globallyLimited(): boolean {
  const now = Date.now();
  if (now - globalWindowStart >= WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
  }
  globalCount += 1;
  return globalCount > MAX_GLOBAL_PER_WINDOW;
}

function rateLimited(key: string): boolean {
  if (seen.size > 2000) seen.clear();
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  recent.push(now);
  seen.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

function trim(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, max);
}

export async function POST(request: Request) {
  // x-real-ip is set by the platform. If only x-forwarded-for is present, use
  // its last hop, not the first value a client can prepend.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    request.headers.get("x-real-ip") ??
    forwarded?.split(",").pop()?.trim() ??
    "unknown";

  if (globallyLimited() || rateLimited(ip)) return new Response(null, { status: 204 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }

  const message = trim(body.message, 2000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!message || !url || !key) return new Response(null, { status: 204 });

  const source = body.source === "server" ? "server" : "client";

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabase.from("error_events").insert({
      source,
      message,
      stack: trim(body.stack, 8000),
      path: trim(body.path, 300),
      digest: trim(body.digest, 100),
    });

    // Keep the table small without a separate cleanup job.
    const { data } = await supabase
      .from("error_events")
      .select("id")
      .order("created_at", { ascending: false })
      .range(500, 1000);

    if (data && data.length > 0) {
      await supabase
        .from("error_events")
        .delete()
        .in(
          "id",
          (data as Array<{ id: string }>).map((row) => row.id),
        );
    }
  } catch {
    // Never surface intake failures to the page that is already failing.
  }

  return new Response(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
