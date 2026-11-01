import type { MetadataRoute } from "next";

/**
 * The public pages (landing and policies) are indexable; the app, sign-in,
 * auth callback, API and settings are private. robots.txt is a request rather
 * than access control; the proxy is what actually enforces them.
 *
 * A trailing `Disallow: /` used to sit above the private routes, which blocked
 * every legal page the sitemap advertises.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/login", "/auth", "/api", "/settings"],
      },
      // Model crawlers may read the landing page and the policy pages, and
      // nothing else. This is a request, not access control.
      { userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"], allow: "/", disallow: ["/app", "/login", "/auth", "/api"] },
    ],
  };
}
