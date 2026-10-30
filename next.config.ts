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
