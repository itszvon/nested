/**
 * Operator details shown on the legal pages.
 *
 * Change SUPPORT_EMAIL to an address you actually monitor before launch. It is
 * the only way a user can request deletion today, because in-app account
 * deletion needs a service-role key that this deployment does not have.
 */
export const SUPPORT_EMAIL = "pothole3000@gmail.com";
export const OPERATOR = "Nested";

/**
 * The public origin. Configured first, then Vercel's production URL, then the
 * dev default. A production build with neither configured warns loudly rather
 * than silently publishing localhost URLs in the sitemap.
 */
const CONFIGURED_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null);

export const SITE_URL = (CONFIGURED_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");

if (!CONFIGURED_ORIGIN && process.env.NODE_ENV === "production") {
  console.warn(
    "NEXT_PUBLIC_SITE_URL is not set. Canonical URLs, the sitemap and OAuth redirects will point at localhost.",
  );
}

/**
 * The public origin of the request. Server actions carry an origin header;
 * when they do not, the proxy headers are enough. This keeps production links
 * correct without needing an environment variable set on the host.
 */
export function requestOrigin(headers: Headers): string {
  // Prefer the configured public origin. Request headers are only a local-dev
  // fallback; letting an Origin header choose the OAuth redirect target is a
  // trust decision we do not need.
  if (CONFIGURED_ORIGIN) return SITE_URL;

  // Production never derives the origin from a request header: a client can
  // send its own x-forwarded-host, and that value decides OAuth redirects.
  if (process.env.NODE_ENV === "production") return SITE_URL;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return SITE_URL;

  const proto = headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Emergency switch for the highest-risk feature in the product: executing user
 * code. Set NEXT_PUBLIC_RUNNER_ENABLED=false and redeploy to hide the Run
 * button and refuse the panel, without touching anything else.
 */
export const RUNNER_ENABLED = process.env.NEXT_PUBLIC_RUNNER_ENABLED !== "false";
