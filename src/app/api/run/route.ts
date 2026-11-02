import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { isRemoteLanguage, runRemotely } from "@/lib/run-remote";

/**
 * Server-side execution for languages the browser cannot run.
 *
 * The code goes to a sandboxed judge, so this route is authenticated and
 * rate-limited per account. It never logs the program text.
 */
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const MAX_CODE = 200_000;

const seen = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  if (seen.size > 5000) seen.clear();
  const now = Date.now();
  const recent = (seen.get(userId) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  recent.push(now);
  seen.set(userId, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  // Same emergency switch as the Run button. The API must not stay open when
  // execution is turned off for the whole deployment.
  if (process.env.NEXT_PUBLIC_RUNNER_ENABLED === "false") {
    return NextResponse.json({ error: "The runner is disabled." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to run this language." }, { status: 401 });
  }

  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many runs in a minute. Wait a moment." },
      { status: 429 },
    );
  }

  let body: { language?: unknown; code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const language = typeof body.language === "string" ? body.language : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!isRemoteLanguage(language)) {
    return NextResponse.json({ error: "That language does not run remotely." }, { status: 400 });
  }
  if (code.trim().length === 0) {
    return NextResponse.json({ error: "There is nothing to run." }, { status: 400 });
  }
  if (code.length > MAX_CODE) {
    return NextResponse.json({ error: "That file is too large to run." }, { status: 413 });
  }

  const result = await runRemotely({ language, code });
  return NextResponse.json(result);
}
