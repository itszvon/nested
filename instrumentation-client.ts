import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    // File content must never leave the browser inside an error payload.
    beforeSend(event) {
      delete event.request?.data;
      return event;
    },
  });
}
