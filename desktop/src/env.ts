import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { app } from "electron";

/**
 * Fixed port, because the OAuth redirect URI registered with Google and
 * Supabase cannot contain a wildcard. If this port is taken, the app shows a
 * retry dialog rather than silently moving and breaking sign-in.
 */
export const PORT = Number(process.env.NESTED_DESKTOP_PORT ?? 43110);
export const ORIGIN = `http://127.0.0.1:${PORT}`;

let cachedToken: string | null = null;

/**
 * Per-launch handshake secret. The local server refuses requests without it,
 * so another process on the machine cannot reuse the user's cookie jar.
 */
export function token(): string {
  if (cachedToken === null) {
    cachedToken = randomBytes(32).toString("hex");
  }
  return cachedToken;
}

/** Where the Next standalone server lives, packaged or in the repo. */
export function standaloneEntry(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "standalone", "server.js")
    : join(__dirname, "..", "..", ".next", "standalone", "server.js");
}

export function preloadPath(): string {
  return join(__dirname, "preload.js");
}

export const IS_SMOKE = process.env.NESTED_SMOKE === "1";
