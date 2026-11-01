/**
 * RFC 9116 security.txt, generated so `Expires` can never silently lapse.
 *
 * One year from the request date, always in the future. The old static file in
 * public/.well-known had a hard-coded date that would need a yearly edit.
 */

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function GET() {
  const expires = new Date(Date.now() + ONE_YEAR_MS).toISOString();

  const body = [
    "Contact: mailto:pothole3000@gmail.com",
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    "Canonical: /home",
    "Policy: /security",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
