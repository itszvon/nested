import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting. No-ops without a DSN, so local development
 * and CI never need Sentry credentials.
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
