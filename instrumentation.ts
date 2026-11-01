import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side error reporting.
 *
 * Sentry is used when a DSN exists; without one, every request error is written
 * to the first-party `error_events` table instead, so production failures are
 * still recorded on the free tier.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

type RequestInfo = { path?: string; method?: string };
type ContextInfo = { routerKind?: string; routePath?: string; routeType?: string };

export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: ContextInfo,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const path = `${request?.method ?? "GET"} ${request?.path ?? context?.routePath ?? "unknown"}`;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabase.from("error_events").insert({
      source: "server",
      message: err.message.slice(0, 2000),
      stack: err.stack?.slice(0, 8000) ?? null,
      path: path.slice(0, 300),
    });
  } catch {
    // Reporting must never throw inside the error pipeline.
  }
}
