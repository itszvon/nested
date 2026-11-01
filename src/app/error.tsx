"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // First-party log; visible in Settings. Sentry, when configured, also sees it.
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "client",
        message: error.message,
        stack: error.stack,
        path: window.location.pathname,
        digest: error.digest,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">error</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink">
          Something broke on this page
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
          Unsaved edits are still in this browser and will be offered back when you reopen the file.
          Try again; if it keeps failing, the reference below helps track it down.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[10px] text-ink-faint">reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="border border-accent bg-accent px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
          >
            Try again
          </button>
          <a
            href="/app"
            className="border border-rule-strong px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
          >
            Back to the app
          </a>
        </div>
      </div>
    </main>
  );
}
