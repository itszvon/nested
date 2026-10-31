import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Default is 1 MB. A 2 MB file becomes ~2.2 MB of JSON plus overhead,
      // so the real cap (2 MB) is enforced in Postgres, and this only
      // stops the transport from rejecting a legitimate save.
      bodySizeLimit: "4mb",
    },
  },
  // Cross-origin isolation. Required for SharedArrayBuffer, which is the only
  // way a browser can block Python on typed input. Everything loaded as a
  // subresource must therefore be CORS-enabled, which the Pyodide CDN is.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
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
