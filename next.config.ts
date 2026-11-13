import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * `unsafe-eval` is required: the code runner executes user programs with
 * `eval` inside a worker, and workers inherit the document policy. `blob:` is
 * required for the same reason and for Pyodide's worker bootstrap. The CDN
 * entries cover Pyodide, Prettier and sql.js, which are loaded on demand.
 *
 * Tighten this if the runner is ever removed.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: https://*.supabase.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Cross-origin isolation: required for SharedArrayBuffer, which is the only
  // way a browser can block Python on typed input.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  // Only meaningful over HTTPS, so it is not sent by the dev server.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Only the desktop build needs a self-contained server directory. Vercel
  // manages its own output, and emitting `.next/standalone` on every web
  // build would only add files nobody deploys. See scripts/build-desktop.mjs.
  output: process.env.NEXT_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Default is 1 MB. A 2 MB file becomes ~2.2 MB of JSON plus overhead,
      // so the real cap (2 MB) is enforced in Postgres, and this only
      // stops the transport from rejecting a legitimate save.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
