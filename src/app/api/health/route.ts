import { connection, NextResponse } from "next/server";
import { readSupabaseEnv } from "@/lib/env";

/**
 * Keep-alive and uptime probe.
 *
 * The free Supabase tier pauses a project after 7 days without requests.
 * A daily call to the auth health endpoint keeps it awake and gives the
 * uptime monitor something honest to watch. No user data is touched.
 */
export async function GET() {
  // Opt out of prerendering: this must always hit the network.
  await connection();

  const env = readSupabaseEnv();

  if (!env) {
    return NextResponse.json(
      { ok: false, reason: "not-configured" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.key },
      cache: "no-store",
    });

    return NextResponse.json(
      { ok: response.ok, database: response.status },
      { status: response.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unreachable" },
      { status: 503 },
    );
  }
}
