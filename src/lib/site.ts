/**
 * Operator details shown on the legal pages.
 *
 * Change SUPPORT_EMAIL to an address you actually monitor before launch. It is
 * the only way a user can request deletion today, because in-app account
 * deletion needs a service-role key that this deployment does not have.
 */
export const SUPPORT_EMAIL = "pothole3000@gmail.com";
export const OPERATOR = "Nested";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * The public origin of the request. Server actions carry an origin header;
 * when they do not, the proxy headers are enough. This keeps production links
 * correct without needing an environment variable set on the host.
 */
export function requestOrigin(headers: Headers): string {
  const origin = headers.get("origin");
  if (origin) return origin;

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
