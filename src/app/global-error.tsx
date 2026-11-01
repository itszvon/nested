"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "client",
        message: error.message,
        stack: error.stack,
        path: typeof window === "undefined" ? null : window.location.pathname,
        digest: error.digest,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#0a0c0b",
          color: "#e9e7e1",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#6a706b",
              margin: 0,
            }}
          >
            error
          </p>
          <h1 style={{ fontSize: 22, margin: "12px 0 0", fontWeight: 600 }}>
            Nested could not load
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#9aa09a", marginTop: 12 }}>
            The page failed before it could render. Reloading usually fixes it; your saved work is
            in the database either way.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              background: "#a8442f",
              color: "white",
              border: "1px solid #a8442f",
              padding: "8px 16px",
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <p style={{ fontSize: 10, color: "#6a706b", marginTop: 16 }}>
            {error.digest ? `reference ${error.digest}` : ""}
          </p>
        </div>
      </body>
    </html>
  );
}
