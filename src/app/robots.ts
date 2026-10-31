import type { MetadataRoute } from "next";

/**
 * Only the landing page is indexable. The app, sign-in, auth callback and API
 * are private, and robots.txt is a request rather than access control; the
 * proxy is what actually enforces them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/home",
        disallow: ["/app", "/login", "/auth", "/api", "/"],
      },
      // Model crawlers may read the landing page and the policy pages, and
      // nothing else. This is a request, not access control.
      { userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"], allow: "/", disallow: ["/app", "/login", "/auth", "/api"] },
    ],
  };
}
