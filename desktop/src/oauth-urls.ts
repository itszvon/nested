/**
 * Which navigations belong in the system browser.
 *
 * Google refuses OAuth inside an embedded webview ("disallowed_useragent"), and
 * the Supabase hosted flow lands on the same consent screen. Both are opened
 * externally; everything else stays in the app window.
 */

const OAUTH_HOSTS = new Set(["accounts.google.com", "oauth2.googleapis.com"]);

export function isOAuthNavigation(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (OAUTH_HOSTS.has(url.hostname)) return true;

  // Hosted Supabase flow: <project>.supabase.co/auth/v1/authorize?provider=google
  return (
    url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/auth/v1/authorize")
  );
}
