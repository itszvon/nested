import { SITE_URL } from "@/lib/site";

/**
 * RFC 9116 security.txt, generated so `Expires` can never silently lapse.
 * `Canonical` must be an absolute URI.
 */

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function GET() {
  const expires = new Date(Date.now() + ONE_YEAR_MS).toISOString();

  const body = [
    `Contact: mailto:${"pothole3000@gmail.com"}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    `Policy: ${SITE_URL}/security`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
