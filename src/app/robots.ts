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
    ],
  };
}
